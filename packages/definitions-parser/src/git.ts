import { PackageId, AllPackages, NotNeededPackage, getDependencyFromFile, formatTypingVersion } from "./packages";
import { Logger, execAndThrowErrors, consoleLogger, assertDefined, cacheDir } from "@definitelytyped/utils";
import * as pacote from "pacote";
import * as semver from "semver";
import { inspect } from "util";
import { PreparePackagesResult, getAffectedPackages } from "./get-affected-packages";

export type GitDiff =
  | {
      status: "A" | "D" | "M";
      file: string;
    }
  | {
      status: "R";
      file: string;
      source: string;
    };

/*
We have to be careful about how we get the diff because Actions uses a shallow clone.

Actions runs:
    git clone --depth=50 https://github.com/DefinitelyTyped/DefinitelyTyped.git DefinitelyTyped
    cd DefinitelyTyped
    git fetch origin +refs/pull/123/merge
    git checkout -qf FETCH_HEAD

If editing this code, be sure to test on both full and shallow clones.
*/
export async function gitDiff(log: Logger, definitelyTypedPath: string, diffBase: string): Promise<GitDiff[]> {
  await run("git", ["rev-parse", "--verify", diffBase]);

  const diff = (await run("git", ["diff", diffBase, "--name-status"])).trim();
  if (diff === "") {
    // Must have been an empty commit; just return no diffs.
    return [];
  }
  return diff.split("\n").map((line) => {
    const [status, file, destination] = line.split(/\s+/, 3);
    if (status[0] === "R") {
      return { status: "R", file: destination.trim(), source: file.trim() };
    }
    return { status: status.trim(), file: file.trim() } as GitDiff;
  });

  async function run(cmd: string, args: readonly string[]): Promise<string> {
    log(`Running: ${cmd} ${args.join(" ")}`);
    const stdout = await execAndThrowErrors(cmd, args, definitelyTypedPath);
    log(stdout);
    return stdout;
  }
}

/**
 * @returns packages with added or removed files, but not packages with only changed files;
 * {@link getAffectedPackages | those are found by calling pnpm }.
 */
export function gitChanges(
  diffs: GitDiff[],
): { errors: string[] } | { deletions: PackageId[]; additions: PackageId[] } {
  const deletions: Map<string, PackageId> = new Map();
  const additions: Map<string, PackageId> = new Map();
  const errors = [];
  for (const diff of diffs) {
    if (!/types[\\/]/.test(diff.file)) continue;
    if (diff.status === "M") continue;
    const dep = getDependencyFromFile(diff.file);
    if (typeof dep === "object") {
      const key = `${dep.typesDirectoryName}/v${dep.version === "*" ? "*" : formatTypingVersion(dep.version)}`;
      (diff.status === "D" ? deletions : additions).set(key, dep);
      if (diff.status === "R") {
        // add the source of moves to deletions (the destination was just added to additions)
        const srcDep = getDependencyFromFile(diff.source);
        if (typeof srcDep === "object") {
          const srcKey = `${srcDep.typesDirectoryName}/v${
            srcDep.version === "*" ? "*" : formatTypingVersion(srcDep.version)
          }`;
          deletions.set(srcKey, srcDep);
        }
      }
    } else if (dep === undefined) {
      const status = diff.status === "A" || diff.status === "R" ? "add" : "delete";
      errors.push(
        `Unexpected file ${status === "add" ? "added" : "deleted"}: ${diff.file}
You should ` +
          (status === "add"
            ? `only add files that are part of packages.`
            : "only delete files that are a part of removed packages."),
      );
    }
  }
  if (errors.length) return { errors };
  return { deletions: Array.from(deletions.values()), additions: Array.from(additions.values()) };
}
export async function getAffectedPackagesFromDiff(
  allPackages: AllPackages,
  definitelyTypedPath: string,
  diffBase: string,
): Promise<string[] | PreparePackagesResult> {
  const errors = [];
  const diffs = await gitDiff(consoleLogger.info, definitelyTypedPath, diffBase);
  const git = gitChanges(diffs);
  if ("errors" in git) {
    return git.errors;
  }
  if (diffs.find((d) => d.file === "notNeededPackages.json")) {
    const deleteds = await getNotNeededPackages(allPackages, git.deletions);
    if ("errors" in deleteds) errors.push(...deleteds.errors);
    else
      for (const deleted of deleteds) {
        errors.push(...(await checkNotNeededPackage(deleted)));
      }
  }
  const affected = await getAffectedPackages(allPackages, git, definitelyTypedPath, diffBase);
  if (errors.length) {
    return errors;
  }
  if ("errors" in affected) {
    throw new Error("unexpected error array");
  }
  console.log(`Testing ${affected.packageNames.size} changed packages: ${inspect(affected.packageNames)}`);
  console.log(`Testing ${affected.dependents.size} dependent packages: ${inspect(affected.dependents)}`);
  return affected;
}

/**
 * 1. libraryName must exist on npm (SKIPPED and preferably/optionally have been the libraryName in just-deleted header)
 * 2. asOfVersion must be newer than `@types/name@latest` on npm
 * 3. `name@asOfVersion` must exist on npm
 */
export async function checkNotNeededPackage(unneeded: NotNeededPackage): Promise<string[]> {
  const errors = [];
  const replacementPackage = await pacote
    .manifest(`${unneeded.libraryName}@${unneeded.version}`, { cache: cacheDir })
    .catch((reason) => {
      if (reason.code === "E404")
        return `The entry for ${unneeded.name} in notNeededPackages.json has
"libraryName": "${unneeded.libraryName}", but there is no npm package with this name.
Unneeded packages have to be replaced with a package on npm.`;
      else if (reason.code === "ETARGET")
        return `The specified version ${unneeded.version} of ${unneeded.libraryName} is not on npm.`;
      else throw reason;
    }); // eg @babel/parser
  if (typeof replacementPackage === "string") errors.push(replacementPackage);
  const typings = await pacote.manifest(unneeded.name, { cache: cacheDir }).catch((reason) => {
    if (reason.code === "E404") return `Unexpected error: @types package not found for ${unneeded.name}`;
    else throw reason;
  }); // eg @types/babel__parser
  if (typeof typings === "string") {
    errors.push(typings);
    return errors;
  }
  if (!semver.gt(unneeded.version, typings.version))
    errors.push(`The specified version ${unneeded.version} of ${unneeded.libraryName} must be newer than the version
it is supposed to replace, ${typings.version} of ${unneeded.name}.`);
  return errors;
}

/**
 * 1. Find all the deleted files and group by package (error on deleted files outside a package).
 * 2. Make sure that all deleted packages in notNeededPackages have no files left.
 */
export async function getNotNeededPackages(
  allPackages: AllPackages,
  deletions: PackageId[],
): Promise<{ errors: string[] } | NotNeededPackage[]> {
  const deletedPackages = new Set(deletions.map((p) => assertDefined(p.typesDirectoryName)));
  const notNeededs = [];
  const errors = [];
  for (const p of deletedPackages) {
    const hasTyping = await allPackages.hasTypingFor({ typesDirectoryName: p, version: "*" });
    const notNeeded = allPackages.getNotNeededPackage(p);
    if (hasTyping && notNeeded) {
      errors.push(`Please delete all files in ${p} when adding it to notNeededPackages.json.`);
    } else if (notNeeded) {
      notNeededs.push(notNeeded);
    }
  }
  return errors.length ? { errors } : notNeededs;
}
