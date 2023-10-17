import {
  getDefinitelyTyped,
  parseDefinitions,
  getAffectedPackagesFromDiff,
  PreparePackagesResult,
} from "@definitelytyped/definitions-parser";
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
  const result = await getAffectedPackagesFromDiff(allPackages, definitelyTypedPath);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  if (Array.isArray(result)) {
    // TODO: This error handling doesn't make sense but matches the old way. Try removing the previous if statement
    // and changing this one to if (errors.length || Array.isArray(result)) { ... }
    throw new Error([...errors, ...result].join("\n"));
  }
  return result;
}
