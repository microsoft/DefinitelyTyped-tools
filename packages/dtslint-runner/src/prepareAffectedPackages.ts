import {
  getDefinitelyTyped,
  parseDefinitions,
  getAffectedPackagesFromDiff,
} from "@definitelytyped/definitions-parser";
import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";
import { PreparePackagesResult } from "./types";

export async function prepareAffectedPackages(definitelyTypedPath: string, nProcesses: number,): Promise<PreparePackagesResult> {
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

  return {
    packageNames: changedPackages.map((p) => p.subDirectoryPath),
    dependents: dependentPackages.map((p) => p.subDirectoryPath),
  };
}
