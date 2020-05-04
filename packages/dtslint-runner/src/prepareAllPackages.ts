import fs from "fs";
import { pathExists } from "fs-extra";
import { joinPaths, nAtATime, execAndThrowErrors, npmInstallFlags } from "@definitelytyped/utils";
import { PreparePackagesOptions, PreparePackagesResult } from "./types";

export async function prepareAllPackages({
  definitelyTypedPath,
  noInstall
}: PreparePackagesOptions): Promise<PreparePackagesResult> {
  const typesPath = joinPaths(definitelyTypedPath, "types");
  const allPackages = await getAllPackages(typesPath);
  if (!noInstall) {
    await installAllDependencies(typesPath, allPackages);
  }
  return { packageNames: allPackages, dependents: [] };
}

async function getAllPackages(typesDir: string): Promise<readonly string[]> {
  const packageNames = await fs.promises.readdir(typesDir, { withFileTypes: true });
  const results = await nAtATime(1, packageNames, async dir => {
    if (!dir.isDirectory()) {
      return [];
    }
    const packageDir = joinPaths(typesDir, dir.name);
    const files = await fs.promises.readdir(packageDir);
    const packages = [dir.name];
    for (const file of files) {
      if (/^v\d+$/.test(file)) {
        packages.push(`${dir.name}/${file}`);
      }
    }
    return packages;
  });
  return ([] as readonly string[]).concat(...results);
}

/**
 * Install all `package.json` dependencies up-front.
 * This ensures that if `types/aaa` depends on `types/zzz`, `types/zzz`'s dependencies will already be installed.
 */
async function installAllDependencies(typesDir: string, packages: readonly string[]): Promise<void> {
  for (const packageName of packages) {
    const packagePath = joinPaths(typesDir, packageName);
    if (!(await pathExists(joinPaths(packagePath, "package.json")))) {
      continue;
    }

    const cmd = `npm install ${npmInstallFlags}`;
    console.log(`  ${packagePath}: ${cmd}`);
    await execAndThrowErrors(cmd, packagePath);
  }
}
