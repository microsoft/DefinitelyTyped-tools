import { assertDefined, execAndThrowErrors, mapDefined, withoutStart } from "@definitelytyped/utils";
import { sourceBranch, sourceRemote } from "./lib/settings";
import { AllPackages, PackageId, formatTypingVersion, getDependencyFromFile } from "./packages";
import { resolve } from "path";
import { satisfies } from "semver";
export interface PreparePackagesResult {
  readonly packageNames: Set<string>;
  readonly dependents: Set<string>;
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export async function getAffectedPackages(
  allPackages: AllPackages,
  deletions: PackageId[],
  definitelyTypedPath: string
): Promise<PreparePackagesResult> {
  const allDependents = [];
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
  const changedPackageNames = await execAndThrowErrors(
    `pnpm ls -r --depth -1 --parseable --filter '[${sourceRemote}/${sourceBranch}]'`,
    definitelyTypedPath
  );
  // Chunk into 100-package chunks because of CMD.COM's command-line length limit
  for (let i = 0; i < filters.length; i += 100) {
    allDependents.push(
      await execAndThrowErrors(
        `pnpm ls -r --depth -1 --parseable ${filters.slice(i, i + 100).join(" ")}`,
        definitelyTypedPath
      )
    );
  }
  return getAffectedPackagesWorker(allPackages, changedPackageNames, allDependents, definitelyTypedPath);
}
/** This function is exported for testing, since it's determined entirely by its inputs. */
export function getAffectedPackagesWorker(
  allPackages: AllPackages,
  changedOutput: string,
  dependentOutputs: string[],
  definitelyTypedPath: string
): PreparePackagesResult {
  const dt = resolve(definitelyTypedPath);
  const changedDirs = mapDefined(changedOutput.split("\n"), getDirectoryName(dt));
  const dependentDirs = mapDefined(dependentOutputs.join("\n").split("\n"), getDirectoryName(dt));
  const packageNames = new Set(
    changedDirs.map(
      (c) =>
        assertDefined(
          allPackages.tryGetTypingsData(assertDefined(getDependencyFromFile(c + "/index.d.ts"), "bad path " + c))
        ).subDirectoryPath
    )
  );
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
