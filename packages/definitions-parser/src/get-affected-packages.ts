import { assertDefined, execAndThrowErrors, mapDefined, withoutStart } from "@definitelytyped/utils";
import { AllPackages, PackageId, formatTypingVersion, getDependencyFromFile } from "./packages";
import { resolve } from "path";
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
  console.log(deletions.map((d) => d.typesDirectoryName + "@" + (d.version === "*" ? "*" : formatTypingVersion(d.version))));
  const filters = [`--filter '...[jakebailey/pnpm-workspaces-working]'`];
  for (const d of deletions) {
    for (const dep of allPackages.allTypings()) {
      for (const [name, version] of dep.allPackageJsonDependencies()) {
        if ("@types/" + d.typesDirectoryName === name && (d.version === "*" || formatTypingVersion(d.version) === version)) {
          filters.push(`--filter '...{./types/${dep.name}}'`);
          break;
        }
      }
    }
  }
  const changedPackageNames = await execAndThrowErrors(
    `pnpm ls -r --depth -1 --parseable --filter '[jakebailey/pnpm-workspaces-working]'`,
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
      (c) =>
        assertDefined(
          allPackages.tryGetTypingsData(assertDefined(getDependencyFromFile(c + "/index.d.ts"), "bad path " + c))
        ).subDirectoryPath
    )
  );
  // TODO: Check for duplicates in dependentOutputs (PROBABLY by converting to a set, it's really a set anyways)
  const dLines = mapDefined(dependentOutputs.join("\n").split("\n"), (line) => filterPackages(line, dt));
  console.log(dLines);
  const dependents = new Set(
    dLines
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

function filterPackages(line: string, dt: string): string | undefined {
  return line && line !== dt
    ? assertDefined(withoutStart(line, dt + "/"), line + " is missing prefix " + dt)
    : undefined;
}

// TODO: Error message from expect rule needs to mention typeScriptVersion not a comment in the header
// TODO: not-needed script can't delete pnp directories
