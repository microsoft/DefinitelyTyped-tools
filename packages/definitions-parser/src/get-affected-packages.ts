import { assertDefined, execAndThrowErrors, mapDefined, withoutStart } from "@definitelytyped/utils";
import { AllPackages, PackageId, getDependencyFromFile } from "./packages";
import { resolve } from "path";
export interface PreparePackagesResult {
  readonly packageNames: Set<string>;
  readonly dependents: readonly string[];
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export async function getAffectedPackages(
  allPackages: AllPackages,
  deletions: PackageId[],
  definitelyTypedPath: string
): Promise<PreparePackagesResult> {
  // const resolved = changedPackageIds.map((id) => allPackages.tryResolve(id));
  // // If a package doesn't exist, that's because it was deleted.
  // const changed = mapDefined(resolved, (id) => allPackages.tryGetTypingsData(id));
  // const dependent = mapIterable(collectDependers(resolved, await getReverseDependencies(allPackages, resolved, definitelyTypedPath)), (p) =>
  //   allPackages.getTypingsData(p)
  // );
  // [x] Test changes of non-types-packages
  // [ ] Test deletion (you don't test deleted packages)
  // [ ] Test deletion+notNeeded
  // [ ] Test deletion of old vXX packages
  // [ ] Test new packages
  const allDependents = [];
  console.log(deletions.map((d) => d.name));
  for (const d of deletions.map((d) => "@types/" + d.name)) {
    for (const x of allPackages.allTypings()) {
      for (const [name] of x.allPackageJsonDependencies()) {
        if (d === name) {
          allDependents.push(
            await execAndThrowErrors(
              `pnpm ls -r --depth -1 --parseable --filter '...{./types/${x.name}}'`,
              definitelyTypedPath
            )
          );
          break;
        }
      }
    }
  }
  const changedPackageNames = await execAndThrowErrors(
    `pnpm ls -r --depth -1 --parseable --filter '[jakebailey/pnpm-workspaces-working]'`,
    definitelyTypedPath
  );
  allDependents.push(
    await execAndThrowErrors(
      `pnpm ls -r --depth -1 --parseable --filter '...[jakebailey/pnpm-workspaces-working]'`,
      definitelyTypedPath
    )
  );
  return getAffectedPackagesWorker(allPackages, changedPackageNames, allDependents, definitelyTypedPath);
  // return { changedPackages: changed, dependentPackages: sortPackages(dependent), allPackages };
}

export function getAffectedPackagesWorker(
  allPackages: AllPackages,
  changedOutput: string,
  dependentOutputs: string[],
  definitelyTypedPath: string
): PreparePackagesResult {
  const dt = resolve(definitelyTypedPath);
  console.log(dependentOutputs);
  const cLines = mapDefined(changedOutput.split("\n"), (line) => filterPackages(line, dt));
  console.log(cLines);
  const packageNames = new Set(
    cLines.map(
      (c) => assertDefined(allPackages.tryGetTypingsData(assertDefined(getDependencyFromFile(c)))).subDirectoryPath
    )
  );
  // TODO: Check for duplicates in dependentOutputs (PROBABLY by converting to a set, it's really a set anyways)
  const dLines = mapDefined(dependentOutputs.join("\n").split("\n"), (line) => filterPackages(line, dt));
  console.log(dLines);
  const dependents = dLines
    .map(
      (d) =>
        assertDefined(allPackages.tryGetTypingsData(assertDefined(getDependencyFromFile(d))), d + " package not found")
          .subDirectoryPath
    )
    .filter((d) => !packageNames.has(d));
  return { packageNames, dependents };
}

function filterPackages(line: string, dt: string): string | undefined {
  return line && line !== dt
    ? assertDefined(withoutStart(line, dt + "/"), line + " is missing prefix " + dt)
    : undefined;
}

// TODO: Error message from expect rule needs to mention typeScriptVersion not a comment in the header
// TODO: not-needed script can't delete pnp directories
