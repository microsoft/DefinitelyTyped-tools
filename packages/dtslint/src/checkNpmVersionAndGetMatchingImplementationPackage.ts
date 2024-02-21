import type * as attw from "@arethetypeswrong/core";
import * as header from "@definitelytyped/header-parser";
import { satisfies } from "semver";
import { tryPromise } from "./checks";
import { getExpectedNpmVersionFailures } from "./util";

export async function checkNpmVersionAndGetMatchingImplementationPackage(
  packageJson: header.Header,
  packageDirectoryNameWithVersion: string,
): Promise<{
  warnings: string[];
  errors: string[];
  implementationPackage?: attw.Package;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let hasNpmVersionMismatch = false;
  let implementationPackage;
  const attw = await import("@arethetypeswrong/core");
  const typesPackageVersion = `${packageJson.libraryMajorVersion}.${packageJson.libraryMinorVersion}`;
  const packageId = await tryPromise(
    attw.resolveImplementationPackageForTypesPackage(packageJson.name, `${typesPackageVersion}.9999`, {
      allowDeprecated: true,
    }),
  );
  const npmVersionExemptions = await getExpectedNpmVersionFailures();
  if (packageId) {
    const { packageName, packageVersion, tarballUrl } = packageId;
    if (packageJson.nonNpm === true) {
      errors.push(
        `Package ${packageJson.name} is marked as non-npm, but ${packageName} exists on npm. ` +
          `If these types are being added to DefinitelyTyped for the first time, please choose ` +
          `a different name that does not conflict with an existing npm package.`,
      );
    } else if (!packageJson.nonNpm) {
      if (!satisfies(packageVersion, typesPackageVersion)) {
        hasNpmVersionMismatch = true;
        const isError = !npmVersionExemptions.has(packageDirectoryNameWithVersion);
        const container = isError ? errors : warnings;
        container.push(
          (isError
            ? ""
            : `Ignoring npm version error because ${packageDirectoryNameWithVersion} was failing when the check was added. ` +
              `If you are making changes to this package, please fix this error:\n> `) +
            `Cannot find a version of ${packageName} on npm that matches the types version ${typesPackageVersion}. ` +
            `The closest match found was ${packageName}@${packageVersion}. ` +
            `If these types are for the existing npm package ${packageName}, change the ${packageDirectoryNameWithVersion}/package.json ` +
            `major and minor version to match an existing version of the npm package. If these types are unrelated to ` +
            `the npm package ${packageName}, add \`"nonNpm": true\` to the package.json and choose a different name ` +
            `that does not conflict with an existing npm package.`,
        );
      } else {
        try {
          implementationPackage = await attw.createPackageFromTarballUrl(tarballUrl);
        } catch (err: any) {
          warnings.push(
            `Failed to extract implementation package from ${tarballUrl}. This is likely a problem with @arethetypeswrong/core ` +
              `or the tarball data itself. @arethetypeswrong/cli will not run. Error:\n${err.stack ?? err.message}`,
          );
        }
      }
    }
  } else if (packageJson.nonNpm === "conflict") {
    errors.push(
      `Package ${packageJson.name} is marked as \`"nonNpm": "conflict"\`, but no conflicting package name was ` +
        `found on npm. These non-npm types can be makred as \`"nonNpm": true\` instead.`,
    );
  } else if (!packageJson.nonNpm) {
    errors.push(
      `Package ${packageJson.name} is not marked as non-npm, but no implementation package was found on npm. ` +
        `If these types are not for an npm package, please add \`"nonNpm": true\` to the package.json. ` +
        `Otherwise, ensure the name of this package matches the name of the npm package.`,
    );
  }

  if (!hasNpmVersionMismatch && npmVersionExemptions.has(packageDirectoryNameWithVersion)) {
    warnings.push(
      `${packageDirectoryNameWithVersion} can be removed from expectedNpmVersionFailures.txt in https://github.com/microsoft/DefinitelyTyped-tools/blob/main/packages/dtslint.`,
    );
  }

  return {
    warnings,
    errors,
    implementationPackage,
  };
}
