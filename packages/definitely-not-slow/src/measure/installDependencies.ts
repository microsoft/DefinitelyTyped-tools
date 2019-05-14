import * as os from 'os';
import * as path from 'path';
import { allDependencies, getAffectedPackages } from 'types-publisher/bin/tester/get-affected-packages';
import { AllPackages, PackageId } from 'types-publisher/bin/lib/packages';
import { nAtATime } from 'types-publisher/bin/util/util';
import { pathExists, run } from '../common';

export async function installDependencies(allPackages: AllPackages, packageId: PackageId, typesPath: string): Promise<void> {
  const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [packageId]);
  const dependencies = allDependencies(allPackages, [...changedPackages, ...dependentPackages]);
  await nAtATime(Math.min(os.cpus().length, 6), dependencies, async typingsData => {
      const packagePath = path.join(typesPath, typingsData.name);
      if (!await pathExists(path.join(packagePath, 'package.json'))) {
          return;
      }

      const cmd = 'npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links';
      return run(packagePath, cmd);
  });
}