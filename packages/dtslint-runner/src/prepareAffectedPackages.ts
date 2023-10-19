import {
  getDefinitelyTyped,
  getAffectedPackagesFromDiff,
  PreparePackagesResult,
  AllPackages,
} from "@definitelytyped/definitions-parser";
import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";

export async function prepareAffectedPackages(
  definitelyTypedPath: string,
): Promise<PreparePackagesResult> {
  const log = loggerWithErrors()[0];
  const options = {
    definitelyTypedPath,
    progress: false,
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = AllPackages.fromFS(dt);
  const checkErrors = await checkParseResults(allPackages);
  const result = await getAffectedPackagesFromDiff(allPackages, definitelyTypedPath);
  const errors = [...checkErrors, ...(Array.isArray(result) ? result : [])];
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  return result as PreparePackagesResult;
}
