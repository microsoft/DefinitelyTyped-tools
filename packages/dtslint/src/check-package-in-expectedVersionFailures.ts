#!/usr/bin/env node

import { join as joinPaths } from "node:path";

import { getTypesVersions } from "@definitelytyped/header-parser";
import { mangleScopedPackage } from "@definitelytyped/utils";

import { checkNpmVersionAndGetMatchingImplementationPackage, checkPackageJson } from "./checks";
import { findDTRootAndPackageNameFrom, packageDirectoryNameWithVersionFromPath } from "./util";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log(`dtslint@${require("../package.json").version}`);
  if (args.length === 1 && args[0] === "types") {
    console.log(
      "Please provide a package name to test.\nTo test all changed packages at once, run `pnpm run test-all`.",
    );
    process.exit(1);
  }

  const dirPath = args.reduce((acc, arg) => joinPaths(acc, mangleScopedPackage(arg)), process.cwd());

  console.log(
    `Should ${dirPath} stay in expectedNpmVersionFailures? ${await shouldPackageStayInExpectedVersionFailures(dirPath)}`,
  );
}

/**
 * @returns Warning text - should be displayed during the run, but does not indicate failure.
 */
async function shouldPackageStayInExpectedVersionFailures(dirPath: string): Promise<boolean> {
  try {
    await findDTRootAndPackageNameFrom(dirPath);
  } catch {
    return false;
  }

  const packageJson = checkPackageJson(dirPath, getTypesVersions(dirPath));
  if (Array.isArray(packageJson)) {
    console.error(new Error("\n\t* " + packageJson.join("\n\t* ")));

    return false;
  }

  const packageDirectoryNameWithVersion = packageDirectoryNameWithVersionFromPath(dirPath);

  const { warnings } = await checkNpmVersionAndGetMatchingImplementationPackage(
    packageJson,
    packageDirectoryNameWithVersion,
  );

  const partialRemovableWarning = " can be removed from expectedNpmVersionFailures.txt in ";
  const canBeRemovedForDirPath = warnings.some((msg) => msg.includes(partialRemovableWarning));

  return !canBeRemovedForDirPath;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack);
    process.exit(1);
  });
} else {
  module.exports = shouldPackageStayInExpectedVersionFailures;
}
