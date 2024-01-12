import console from "console";
import { AllPackages, getDefinitelyTyped } from "@definitelytyped/definitions-parser";
if (require.main === module) {
  const options = { definitelyTypedPath: undefined, progress: false };
  getDefinitelyTyped(options, console).then((dt) => {
    return checkParseResults(AllPackages.fromFS(dt));
  });
}

export async function checkParseResults(allPackages: AllPackages): Promise<string[]> {
  const errors = [];
  for (const pkg of await allPackages.allTypings()) {
    for await (const dep of allPackages.allDependencyTypings(pkg)) {
      if (dep.minTypeScriptVersion > pkg.minTypeScriptVersion) {
        errors.push(
          `${pkg.desc} depends on ${dep.desc} but has a lower required TypeScript version (${pkg.minTypeScriptVersion} < ${dep.minTypeScriptVersion}).`,
        );
      }
    }
  }
  return [...allPackages.getErrorsAsArray(), ...errors];
}
