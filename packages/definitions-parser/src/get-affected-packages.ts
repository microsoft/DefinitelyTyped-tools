import { assertDefined, execAndThrowErrors, mapDefined, normalizeSlashes, withoutStart } from "@definitelytyped/utils";
import { sourceBranch, sourceRemote } from "./lib/settings";
import { AllPackages, formatTypingVersion, getDependencyFromFile } from "./packages";
import { resolve } from "path";
import { satisfies } from "semver";
import { GitDiff, gitChanges } from "./git";
export interface PreparePackagesResult {
  readonly packageNames: Set<string>;
  readonly dependents: Set<string>;
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export async function getAffectedPackages(
  allPackages: AllPackages,
  diffs: GitDiff[],
  definitelyTypedPath: string,
): Promise<{ errors: string[] } | PreparePackagesResult> {
  const errors = [];
  // No ... prefix; we only want packages that were actually edited.
  const changedPackageDirectories = await execAndThrowErrors(
    "pnpm",
    ["ls", "-r", "--depth", "-1", "--parseable", "--filter", `@types/**[${sourceRemote}/${sourceBranch}]`],
    definitelyTypedPath,
  );

  const git = gitChanges(diffs);
  if ("errors" in git) {
    errors.push(...git.errors);
    return { errors };
  }
  const { additions, deletions } = git;
  const addedPackageDirectories = mapDefined(additions, (id) => id.typesDirectoryName);
  const allDependentDirectories = [];
  // Start the filter off with all packages that were touched along with those that depend on them.
  const filters = ["--filter", `...@types/**[${sourceRemote}/${sourceBranch}]`];
  // For packages that have been deleted, they won't appear in the graph anymore; look for packages
  // that still depend on the package (but via npm) and manually add them.
  for (const d of deletions) {
    for (const dep of await allPackages.allTypings()) {
      for (const [name, version] of dep.allPackageJsonDependencies()) {
        if (
          "@types/" + d.typesDirectoryName === name &&
          (d.version === "*" || satisfies(formatTypingVersion(d.version), version))
        ) {
          filters.push("--filter", `...${dep.name}`);
          break;
        }
      }
    }
  }
  // Chunk into 100-package chunks because of CMD.COM's command-line length limit
  for (let i = 0; i < filters.length; i += 100) {
    allDependentDirectories.push(
      await execAndThrowErrors(
        "pnpm",
        ["ls", "-r", "--depth", "-1", "--parseable", ...filters.slice(i, i + 100)],
        definitelyTypedPath,
      ),
    );
  }
  return getAffectedPackagesWorker(
    allPackages,
    changedPackageDirectories,
    addedPackageDirectories,
    allDependentDirectories,
    definitelyTypedPath,
  );
}
/** This function is exported for testing, since it's determined entirely by its inputs. */
export async function getAffectedPackagesWorker(
  allPackages: AllPackages,
  changedOutput: string,
  additions: string[],
  dependentOutputs: string[],
  definitelyTypedPath: string,
): Promise<PreparePackagesResult> {
  const dt = resolve(definitelyTypedPath);
  const changedDirs = mapDefined(changedOutput.split("\n"), getDirectoryName(dt));
  const dependentDirs = mapDefined(dependentOutputs.join("\n").split("\n"), getDirectoryName(dt));
  const packageNames = new Set([
    ...additions,
    ...(await Promise.all(changedDirs.map(tryGetTypingsData))).filter((d): d is string => !!d),
  ]);
  const dependents = new Set(
    (await Promise.all(dependentDirs.map(tryGetTypingsData))).filter((d): d is string => !!d && !packageNames.has(d)),
  );
  return { packageNames, dependents };

  async function tryGetTypingsData(d: string) {
    const dep = getDependencyFromFile(normalizeSlashes(d + "/index.d.ts"));
    if (!dep) return undefined;
    const data = await allPackages.tryGetTypingsData(dep);
    if (!data) return undefined;
    return data.subDirectoryPath;
  }
}

function getDirectoryName(dt: string): (line: string) => string | undefined {
  dt = normalizeSlashes(dt);
  return (line) => {
    line = normalizeSlashes(line);
    return line && line !== dt
      ? assertDefined(withoutStart(line, dt + "/"), line + " is missing prefix " + dt)
      : undefined;
  };
}
