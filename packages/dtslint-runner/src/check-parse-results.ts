import console from "console";
import { AllPackages, getDefinitelyTyped } from "@definitelytyped/definitions-parser";
if (require.main === module) {
  const options = { definitelyTypedPath: undefined, progress: false, parseInParallel: false };
  getDefinitelyTyped(options, console).then((dt) => {
    AllPackages.read(dt).then(checkParseResults);
  });
}

export function checkParseResults(allPackages: AllPackages): string[] {
  const errors = [];
  for (const pkg of allPackages.allTypings()) {
    for (const dep of allPackages.allDependencyTypings(pkg)) {
      if (dep.minTypeScriptVersion > pkg.minTypeScriptVersion) {
        errors.push(
          `${pkg.desc} depends on ${dep.desc} but has a lower required TypeScript version (${pkg.minTypeScriptVersion} < ${dep.minTypeScriptVersion}).`
        );
      }
    }
  }
  return errors
}
