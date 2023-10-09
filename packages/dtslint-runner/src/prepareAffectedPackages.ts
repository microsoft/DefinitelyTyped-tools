import { getDefinitelyTyped, parseDefinitions, getAffectedPackagesFromDiff, PreparePackagesResult } from "@definitelytyped/definitions-parser";
import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";

export async function prepareAffectedPackages(
  definitelyTypedPath: string,
  nProcesses: number
): Promise<PreparePackagesResult> {
  const log = loggerWithErrors()[0];
  const options = {
    definitelyTypedPath,
    progress: false,
    parseInParallel: nProcesses > 1,
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = await parseDefinitions(dt, nProcesses ? { definitelyTypedPath, nProcesses } : undefined, log);
  const errors = checkParseResults(allPackages);
  // TODO: getAffectedPackagesFromDiff also should not throw, but return an array of errors
  const result = await getAffectedPackagesFromDiff(allPackages, definitelyTypedPath, "affected");
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  return result
}
