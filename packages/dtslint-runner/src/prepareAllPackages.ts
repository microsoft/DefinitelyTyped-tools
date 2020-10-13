import {
  AllPackages,
  getDefinitelyTyped,
  checkParseResults,
  parseDefinitions
} from "@definitelytyped/definitions-parser";
import { joinPaths, loggerWithErrors } from "@definitelytyped/utils";
import { installDependencies } from "./prepareAffectedPackages";
import { PreparePackagesOptions, PreparePackagesResult } from "./types";

export async function prepareAllPackages({
  definitelyTypedPath,
  noInstall,
  nProcesses
}: PreparePackagesOptions): Promise<PreparePackagesResult> {
  const typesPath = joinPaths(definitelyTypedPath, "types");
  const [log] = loggerWithErrors();
  const options = {
    definitelyTypedPath,
    progress: false,
    parseInParallel: nProcesses > 1
  };
  const dt = await getDefinitelyTyped(options, log);
  await parseDefinitions(dt, nProcesses ? { definitelyTypedPath, nProcesses } : undefined, log);
  await checkParseResults(/*includeNpmChecks*/ false, dt, options);
  const allPackages = await AllPackages.read(dt);
  if (!noInstall) {
    await installDependencies(allPackages.allTypings(), typesPath);
  }
  return { packageNames: allPackages.allTypings().map(({ subDirectoryPath }) => subDirectoryPath), dependents: [] };
}
