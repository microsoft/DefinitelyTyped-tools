import { getDefinitelyTyped, parseDefinitions, PreparePackagesResult  } from "@definitelytyped/definitions-parser";
import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";

export async function prepareAllPackages(
  definitelyTypedPath: string,
  nProcesses: number
): Promise<PreparePackagesResult> {
  const [log] = loggerWithErrors();
  const options = {
    definitelyTypedPath,
    progress: false,
    parseInParallel: nProcesses > 1,
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = await parseDefinitions(dt, nProcesses ? { definitelyTypedPath, nProcesses } : undefined, log);
  checkParseResults(allPackages);
  return { packageNames: new Set(allPackages.allTypings().map(({ subDirectoryPath }) => subDirectoryPath)), dependents: [] };
}
