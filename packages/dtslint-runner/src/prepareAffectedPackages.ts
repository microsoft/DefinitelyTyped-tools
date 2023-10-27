import {
  getDefinitelyTyped,
  getAffectedPackagesFromDiff,
  PreparePackagesResult,
  AllPackages,
} from "@definitelytyped/definitions-parser";
import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";

export async function prepareAffectedPackages(definitelyTypedPath: string): Promise<PreparePackagesResult> {
  const log = loggerWithErrors()[0];
  const options = {
    definitelyTypedPath,
    progress: false,
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = AllPackages.fromFS(dt);
  const checkErrors = await checkParseResults(allPackages);
  if (checkErrors.length) {
    throw new Error(checkErrors.join("\n"));
  }
  const result = await getAffectedPackagesFromDiff(allPackages, definitelyTypedPath);
  if (Array.isArray(result)) {
    throw new Error(result.join("\n"));
  }
  return result;
}
