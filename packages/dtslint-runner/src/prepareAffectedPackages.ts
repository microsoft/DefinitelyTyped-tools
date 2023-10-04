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
  try {
    checkParseResults(allPackages);
  } catch (err) {
    // TODO: ??? won't a failure in here squelch any errors from checkParseResults? Seems like a bad idea.
    await getAffectedPackagesFromDiff(allPackages, definitelyTypedPath, "affected");
    throw err;
  }

  return getAffectedPackagesFromDiff(allPackages, definitelyTypedPath, "affected");
}
