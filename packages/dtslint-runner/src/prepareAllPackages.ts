import { AllPackages, getDefinitelyTyped, parseDefinitions } from "@definitelytyped/definitions-parser";
import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";
import { installDependencies } from "./prepareAffectedPackages";
import { PreparePackagesOptions, PreparePackagesResult } from "./types";

export async function prepareAllPackages({
  definitelyTypedPath,
  noInstall,
  nProcesses,
}: PreparePackagesOptions): Promise<PreparePackagesResult> {
  const [log] = loggerWithErrors();
  const options = {
    definitelyTypedPath,
    progress: false,
    parseInParallel: nProcesses > 1,
  };
  const dt = await getDefinitelyTyped(options, log);
  await parseDefinitions(dt, nProcesses ? { definitelyTypedPath, nProcesses } : undefined, log);
  await checkParseResults(/*includeNpmChecks*/ false, dt);
  const allPackages = await AllPackages.read(dt);
  if (!noInstall) {
    await installDependencies(definitelyTypedPath);
  }
  return { packageNames: allPackages.allTypings().map(({ subDirectoryPath }) => subDirectoryPath), dependents: [] };
}
