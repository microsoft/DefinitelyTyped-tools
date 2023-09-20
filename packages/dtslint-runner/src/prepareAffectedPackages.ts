import { pathExists } from "fs-extra";
import {
  getDefinitelyTyped,
  parseDefinitions,
  getAffectedPackagesFromDiff,
  allDependencies,
  TypingsData,
} from "@definitelytyped/definitions-parser";
import { execAndThrowErrors, joinPaths, loggerWithErrors, npmInstallFlags, sleep } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";
import { PreparePackagesOptions, PreparePackagesResult } from "./types";

export async function prepareAffectedPackages({
  definitelyTypedPath,
  noInstall,
  nProcesses,
}: PreparePackagesOptions): Promise<PreparePackagesResult> {
  const typesPath = joinPaths(definitelyTypedPath, "types");
  const log = loggerWithErrors()[0];
  const options = {
    definitelyTypedPath,
    progress: false,
    parseInParallel: nProcesses > 1,
  };
  const dt = await getDefinitelyTyped(options, log);
  await parseDefinitions(dt, nProcesses ? { definitelyTypedPath, nProcesses } : undefined, log);
  try {
    await checkParseResults(/*includeNpmChecks*/ false, dt);
  } catch (err) {
    await getAffectedPackagesFromDiff(dt, definitelyTypedPath, "affected");
    throw err;
  }

  const { changedPackages, dependentPackages, allPackages } = await getAffectedPackagesFromDiff(
    dt,
    definitelyTypedPath,
    "affected"
  );

  if (!noInstall) {
    await installDependencies(allDependencies(allPackages, [...changedPackages, ...dependentPackages]), typesPath);
  }

  return {
    packageNames: changedPackages.map((p) => p.subDirectoryPath),
    dependents: dependentPackages.map((p) => p.subDirectoryPath),
  };
}

const npmRetryCount = 5;

export async function installDependencies(packages: Iterable<TypingsData>, typesPath: string): Promise<void> {
  console.log("Installing NPM dependencies...");
  const start = Date.now();

  // We need to run `npm install` for all dependencies, too, so that we have dependencies' dependencies installed.
  for (const pkg of packages) {
    const cwd = joinPaths(typesPath, pkg.subDirectoryPath);
    if (!(await pathExists(joinPaths(cwd, "package.json")))) {
      continue;
    }

    // Scripts may try to compile native code.
    // This doesn't work reliably on travis, and we're just installing for the types, so ignore.
    const cmd = `npm install ${npmInstallFlags} --tag ts${pkg.minTypeScriptVersion}`;
    console.log(`  ${cwd}: ${cmd}`);

    let lastError;
    for (let i = 0; i < npmRetryCount; i++) {
      try {
        const stdout = await execAndThrowErrors(cmd, cwd);
        if (stdout) {
          // Must specify what this is for since these run in parallel.
          console.log(` from ${cwd}: ${stdout}`);
        }
        lastError = undefined;
        break;
      } catch (e) {
        console.error(`  from ${cwd} attempt ${i+1}: ${e}`);
        lastError = e;
        await sleep(5)
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  console.log(`Took ${(Date.now() - start) / 1000} s`);
}
