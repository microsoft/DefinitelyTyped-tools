import * as os from "os";
import * as path from "path";
import { AllPackages, PackageId, getAffectedPackages, allDependencies } from "@definitelytyped/definitions-parser";
import { nAtATime, execAndThrowErrors } from "@definitelytyped/utils";
import { pathExists } from "../common";

export async function installDependencies(
  allPackages: AllPackages,
  packageId: PackageId,
  typesPath: string
): Promise<void> {
  const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [packageId]);
  const dependencies = allDependencies(allPackages, [...changedPackages, ...dependentPackages]);
  await nAtATime(Math.min(os.cpus().length, 6), dependencies, async typingsData => {
    const packagePath = path.join(typesPath, typingsData.name);
    if (!(await pathExists(path.join(packagePath, "package.json")))) {
      return;
    }

    const cmd = "npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links";
    return execAndThrowErrors(cmd, packagePath);
  });
}
