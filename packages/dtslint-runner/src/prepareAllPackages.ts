import { getDefinitelyTyped, parseDefinitions, PreparePackagesResult } from "@definitelytyped/definitions-parser";
import { execAndThrowErrors, loggerWithErrors, pnpmInstallFlags, sleep } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";

export async function prepareAllPackages(
  definitelyTypedPath: string,
  clone: boolean,
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
  if (clone) {
    await installAllDependencies(definitelyTypedPath);
  }
  const errors = checkParseResults(allPackages);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  return {
    packageNames: new Set(allPackages.allTypings().map(({ subDirectoryPath }) => subDirectoryPath)),
    dependents: new Set(),
  };
}
const npmRetryCount = 5;
export async function installAllDependencies(typesPath: string): Promise<void> {
  console.log("Installing NPM dependencies...");
  const cmd = `pnpm install ${pnpmInstallFlags}`;
  console.log(`  ${typesPath}: ${cmd}`);
  let lastError;
  for (let i = 0; i < npmRetryCount; i++) {
    try {
      const stdout = await execAndThrowErrors(cmd, typesPath);
      if (stdout) {
        console.log(stdout);
      }
      lastError = undefined;
      break;
    } catch (e) {
      console.error(`  from ${typesPath} attempt ${i + 1}: ${e}`);
      lastError = e;
      await sleep(5);
    }
  }

  if (lastError) {
    throw lastError;
  }
}
