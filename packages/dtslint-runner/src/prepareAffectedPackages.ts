import {
  getDefinitelyTyped,
  parseDefinitions,
  getAffectedPackagesFromDiff,
} from "@definitelytyped/definitions-parser";
import { execAndThrowErrors, loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";
import { PreparePackagesOptions, PreparePackagesResult } from "./types";

export async function prepareAffectedPackages({
  definitelyTypedPath,
  noInstall,
  nProcesses,
}: PreparePackagesOptions): Promise<PreparePackagesResult> {
  const log = loggerWithErrors()[0];
  const options = {
    definitelyTypedPath,
    progress: false,
    parseInParallel: nProcesses > 1,
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = await parseDefinitions(dt, nProcesses ? { definitelyTypedPath, nProcesses } : undefined, log);
  try {
    checkParseResults(allPackages);
  } catch (err) {
    await getAffectedPackagesFromDiff(allPackages, definitelyTypedPath, "affected");
    throw err;
  }

  const { changedPackages, dependentPackages } = await getAffectedPackagesFromDiff(
    allPackages,
    definitelyTypedPath,
    "affected"
  );

  if (!noInstall) {
    await installDependencies(definitelyTypedPath);
  }

  return {
    packageNames: changedPackages.map((p) => p.subDirectoryPath),
    dependents: dependentPackages.map((p) => p.subDirectoryPath),
  };
}

export async function installDependencies(definitelyTypedPath: string): Promise<void> {
  console.log("Installing NPM dependencies...");
  const start = Date.now();
  const cwd = definitelyTypedPath;
  const cmd = `pnpm install`;
  console.log(`  ${cwd}: ${cmd}`);
  const stdout = await execAndThrowErrors(cmd, cwd);
  if (stdout) {
    console.log(stdout);
  }
  console.log(`Took ${(Date.now() - start) / 1000} s`);
}
