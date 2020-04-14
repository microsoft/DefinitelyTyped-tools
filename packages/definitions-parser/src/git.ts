import assert from "assert";
import { sourceBranch } from "./lib/settings";
import {
  PackageId,
  DependencyVersion,
  formatDependencyVersion,
  getDependencyFromFile,
  AllPackages,
  NotNeededPackage
} from "./packages";
import {
  Logger,
  execAndThrowErrors,
  flatMapIterable,
  mapIterable,
  FS,
  consoleLogger,
  assertDefined,
  Semver,
  UncachedNpmInfoClient,
  NpmInfo
} from "@definitelytyped/utils";
import { getAffectedPackages } from "./get-affected-packages";

export interface GitDiff {
  status: "A" | "D" | "M";
  file: string;
}

/*
We have to be careful about how we get the diff because travis uses a shallow clone.

Travis runs:
    git clone --depth=50 https://github.com/DefinitelyTyped/DefinitelyTyped.git DefinitelyTyped
    cd DefinitelyTyped
    git fetch origin +refs/pull/123/merge
    git checkout -qf FETCH_HEAD

If editing this code, be sure to test on both full and shallow clones.
*/
export async function gitDiff(log: Logger, definitelyTypedPath: string): Promise<GitDiff[]> {
  try {
    await run(`git rev-parse --verify ${sourceBranch}`);
    // If this succeeds, we got the full clone.
  } catch (_) {
    // This is a shallow clone.
    await run(`git fetch origin ${sourceBranch}`);
    await run(`git branch ${sourceBranch} FETCH_HEAD`);
  }

  let diff = (await run(`git diff ${sourceBranch} --name-status`)).trim();
  if (diff === "") {
    // We are probably already on master, so compare to the last commit.
    diff = (await run(`git diff ${sourceBranch}~1 --name-status`)).trim();
  }
  return diff.split("\n").map(line => {
    const [status, file] = line.split(/\s+/, 2);
    return { status: status.trim(), file: file.trim() } as GitDiff;
  });

  async function run(cmd: string): Promise<string> {
    log(`Running: ${cmd}`);
    const stdout = await execAndThrowErrors(cmd, definitelyTypedPath);
    log(stdout);
    return stdout;
  }
}

/** Returns all immediate subdirectories of the root directory that have changed. */
export function gitChanges(diffs: GitDiff[]): PackageId[] {
  const changedPackages = new Map<string, Map<string, DependencyVersion>>();

  for (const diff of diffs) {
    const dep = getDependencyFromFile(diff.file);
    if (dep) {
      const versions = changedPackages.get(dep.name);
      if (!versions) {
        changedPackages.set(dep.name, new Map([[formatDependencyVersion(dep.version), dep.version]]));
      } else {
        versions.set(formatDependencyVersion(dep.version), dep.version);
      }
    }
  }

  return Array.from(
    flatMapIterable(changedPackages, ([name, versions]) => mapIterable(versions, ([_, version]) => ({ name, version })))
  );
}

export async function getAffectedPackagesFromDiff(
  dt: FS,
  definitelyTypedPath: string,
  selection: "all" | "affected" | RegExp
) {
  const allPackages = await AllPackages.read(dt);
  const diffs = await gitDiff(consoleLogger.info, definitelyTypedPath);
  if (diffs.find(d => d.file === "notNeededPackages.json")) {
    const uncached = new UncachedNpmInfoClient();
    for (const deleted of getNotNeededPackages(allPackages, diffs)) {
      const source = await uncached.fetchNpmInfo(deleted.libraryName); // eg @babel/parser
      const typings = await uncached.fetchNpmInfo(deleted.fullNpmName); // eg @types/babel__parser
      checkNotNeededPackage(deleted, source, typings);
    }
  }

  const affected =
    selection === "all"
      ? { changedPackages: allPackages.allTypings(), dependentPackages: [], allPackages }
      : selection === "affected"
      ? getAffectedPackages(allPackages, gitChanges(diffs))
      : {
          changedPackages: allPackages.allTypings().filter(t => selection.test(t.name)),
          dependentPackages: [],
          allPackages
        };

  console.log(
    `Testing ${affected.changedPackages.length} changed packages: ${affected.changedPackages
      .map(t => t.desc)
      .toString()}`
  );
  console.log(
    `Testing ${affected.dependentPackages.length} dependent packages: ${affected.dependentPackages
      .map(t => t.desc)
      .toString()}`
  );
  return affected;
}

/**
 * 1. libraryName must exist on npm (SKIPPED and preferably/optionally have been the libraryName in just-deleted header)
 * (SKIPPED 2.) sourceRepoURL must exist and be the npm homepage
 * 3. asOfVersion must be newer than `@types/name@latest` on npm
 * 4. `name@asOfVersion` must exist on npm
 *
 * I skipped (2) because the cached npm info doesn't include it. I might add it later.
 */
export function checkNotNeededPackage(
  unneeded: NotNeededPackage,
  source: NpmInfo | undefined,
  typings: NpmInfo | undefined
) {
  source = assertDefined(
    source,
    `The entry for ${unneeded.fullNpmName} in notNeededPackages.json has
"libraryName": "${unneeded.libraryName}", but there is no npm package with this name.
Unneeded packages have to be replaced with a package on npm.`
  );
  typings = assertDefined(typings, `Unexpected error: @types package not found for ${unneeded.fullNpmName}`);
  const latestTypings = Semver.parse(
    assertDefined(
      typings.distTags.get("latest"),
      `Unexpected error: ${unneeded.fullNpmName} is missing the "latest" tag.`
    )
  );
  assert(
    unneeded.version.greaterThan(latestTypings),
    `The specified version ${unneeded.version.versionString} of ${unneeded.libraryName} must be newer than the version
it is supposed to replace, ${latestTypings.versionString} of ${unneeded.fullNpmName}.`
  );
  assert(
    source.versions.has(unneeded.version.versionString),
    `The specified version ${unneeded.version.versionString} of ${unneeded.libraryName} is not on npm.`
  );
}

/**
 * 1. find all the deleted files and group by toplevel
 * 2. Make sure that there are no packages left with deleted entries
 * 3. make sure that each toplevel deleted has a matching entry in notNeededPackages
 */
export function getNotNeededPackages(allPackages: AllPackages, diffs: GitDiff[]): Iterable<NotNeededPackage> {
  const deletedPackages = new Set(
    diffs
      .filter(d => d.status === "D")
      .map(
        d =>
          assertDefined(
            getDependencyFromFile(d.file),
            `Unexpected file deleted: ${d.file}
When removing packages, you should only delete files that are a part of removed packages.`
          ).name
      )
  );
  return mapIterable(deletedPackages, p => {
    if (allPackages.hasTypingFor({ name: p, version: "*" })) {
      throw new Error(`Please delete all files in ${p} when adding it to notNeededPackages.json.`);
    }
    return assertDefined(allPackages.getNotNeededPackage(p), `Deleted package ${p} is not in notNeededPackages.json.`);
  });
}
