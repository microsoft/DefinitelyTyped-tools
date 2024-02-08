import { AllPackages, getDefinitelyTyped, PreparePackagesResult } from "@definitelytyped/definitions-parser";
import { execAndThrowErrors, loggerWithErrors, sleep } from "@definitelytyped/utils";
import { checkParseResults } from "./check-parse-results";

export async function prepareAllPackages(definitelyTypedPath: string, clone: boolean): Promise<PreparePackagesResult> {
  const [log] = loggerWithErrors();
  const options = {
    definitelyTypedPath,
    progress: false,
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = AllPackages.fromFS(dt);
  if (clone) {
    await installAllDependencies(definitelyTypedPath);
  }
  const errors = await checkParseResults(allPackages);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  return {
    packageNames: new Set((await allPackages.allTypings()).map(({ subDirectoryPath }) => subDirectoryPath)),
    dependents: new Set(),
    attwChanges: new Set(),
  };
}
const npmRetryCount = 5;
async function installAllDependencies(definitelyTypedPath: string): Promise<void> {
  console.log("Installing NPM dependencies...");
  const cmd: [string, string[]] = ["pnpm", ["install", "--no-save"]];
  console.log(`  ${definitelyTypedPath}: ${cmd[0]} ${cmd[1].join(" ")}}`);
  let lastError;
  for (let i = 0; i < npmRetryCount; i++) {
    try {
      await execAndThrowErrors(cmd[0], cmd[1], definitelyTypedPath);
      lastError = undefined;
      break;
    } catch (e) {
      console.error(`  from ${definitelyTypedPath} attempt ${i + 1}: ${e}`);
      lastError = e;
      await sleep(5);
    }
  }

  if (lastError) {
    throw lastError;
  }
}
