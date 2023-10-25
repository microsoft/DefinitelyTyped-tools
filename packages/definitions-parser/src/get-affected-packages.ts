import { assertDefined, execAndThrowErrors, mapDefined, withoutStart } from "@definitelytyped/utils";
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
  definitelyTypedPath: string
): Promise<{ errors: string[] } | PreparePackagesResult> {
  const errors = [];
  const changedPackageDirectories = await execAndThrowErrors(
    `pnpm ls -r --depth -1 --parseable --filter '...@types/**[${sourceRemote}/${sourceBranch}]'`,
    definitelyTypedPath
  );

  const git = gitChanges(diffs);
  if ("errors" in git) {
    errors.push(...git.errors);
    return { errors };
  }
  const { additions, deletions } = git;
  const addedPackageDirectories = mapDefined(additions, (id) => id.typesDirectoryName);
  const allDependentDirectories = [];
  const filters = [`--filter '...[${sourceRemote}/${sourceBranch}]'`];
  for (const d of deletions) {
    for (const dep of allPackages.allTypings()) {
      for (const [name, version] of dep.allPackageJsonDependencies()) {
        if (
          "@types/" + d.typesDirectoryName === name &&
          (d.version === "*" || satisfies(formatTypingVersion(d.version), version))
        ) {
          filters.push(`--filter '...${dep.name}'`);
          break;
        }
      }
    }
  }
  // Chunk into 100-package chunks because of CMD.COM's command-line length limit
  for (let i = 0; i < filters.length; i += 100) {
    allDependentDirectories.push(
      await execAndThrowErrors(
        `pnpm ls -r --depth -1 --parseable ${filters.slice(i, i + 100).join(" ")}`,
        definitelyTypedPath
      )
    );
  }
  return getAffectedPackagesWorker(
    allPackages,
    changedPackageDirectories,
    addedPackageDirectories,
    allDependentDirectories,
    definitelyTypedPath
  );
}
/** This function is exported for testing, since it's determined entirely by its inputs. */
export function getAffectedPackagesWorker(
  allPackages: AllPackages,
  changedOutput: string,
  additions: string[],
  dependentOutputs: string[],
  definitelyTypedPath: string
): PreparePackagesResult {
  const dt = resolve(definitelyTypedPath);
  const changedDirs = mapDefined(changedOutput.split("\n"), getDirectoryName(dt));
  const dependentDirs = mapDefined(dependentOutputs.join("\n").split("\n"), getDirectoryName(dt));
  const packageNames = new Set([
    ...additions,
    ...changedDirs.map(
      (c) =>
        assertDefined(
          allPackages.tryGetTypingsData(assertDefined(getDependencyFromFile(c + "/index.d.ts"), "bad path " + c)),
          "bad path " + JSON.stringify(getDependencyFromFile(c + "/index.d.ts"))
        ).subDirectoryPath
    ),
  ]);
  const dependents = new Set(
    dependentDirs
      .map(
        (d) =>
          assertDefined(
            allPackages.tryGetTypingsData(assertDefined(getDependencyFromFile(d + "/index.d.ts"), "bad path " + d)),
            d + " package not found"
          ).subDirectoryPath
      )
      .filter((d) => !packageNames.has(d))
  );
  return { packageNames, dependents };
}

function getDirectoryName(dt: string): (line: string) => string | undefined {
  return (line) =>
    line && line !== dt ? assertDefined(withoutStart(line, dt + "/"), line + " is missing prefix " + dt) : undefined;
}
