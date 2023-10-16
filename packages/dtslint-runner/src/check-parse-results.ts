import console from "console";
import { AllPackages, getDefinitelyTyped } from "@definitelytyped/definitions-parser";
import { assertDefined } from "@definitelytyped/utils";
import * as semver from "semver";
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
      // check raw version because parsed version doesn't currently retain range information
      const version = assertDefined(new Map(pkg.allPackageJsonDependencies()).get(dep.name));
      if (semver.parse(version)) {
        errors.push(
          `${pkg.desc}'s dependency on ${dep.desc}@${version} must use "*" or a version range, not a specific version.`
        );
      }
      if (dep.minTypeScriptVersion > pkg.minTypeScriptVersion) {
        errors.push(
          `${pkg.desc} depends on ${dep.desc} but has a lower required TypeScript version (${pkg.minTypeScriptVersion} < ${dep.minTypeScriptVersion}).`
        );
      }
    }
  }
  return errors;
}
