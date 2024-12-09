import type * as attw from "@arethetypeswrong/core" with { "resolution-mode": "import" };
import * as header from "@definitelytyped/header-parser";
import { AllTypeScriptVersion } from "@definitelytyped/typescript-versions";
import { assertNever, createTgz, deepEquals, streamToBuffer } from "@definitelytyped/utils";
import fs from "fs";
import { join as joinPaths } from "path";
import { satisfies } from "semver";
import { CompilerOptions } from "typescript";
import { getExpectedNpmVersionFailures, packageNameFromPath, readJson } from "./util";

export function checkPackageJson(
  dirPath: string,
  typesVersions: readonly AllTypeScriptVersion[],
): header.Header | string[] {
  const pkgJsonPath = joinPaths(dirPath, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`${dirPath}: Missing 'package.json'`);
  }
  return header.validatePackageJson(packageNameFromPath(dirPath), readJson(pkgJsonPath), typesVersions);
}
/**
 * numbers in `CompilerOptions` might be enum values mapped from strings
 */
export type CompilerOptionsRaw = {
  [K in keyof CompilerOptions]?: CompilerOptions[K] extends number | undefined
    ? string | number | undefined
    : CompilerOptions[K];
};
interface Tsconfig {
  compilerOptions: CompilerOptionsRaw;
  files?: string[];
  include?: string[];
  exclude?: string[];
}

export function checkTsconfig(config: Tsconfig): string[] {
  const errors = [];
  const mustHave = {
    noEmit: true,
    forceConsistentCasingInFileNames: true,
    types: [],
  };
  const options = config.compilerOptions;
  if ("include" in config) {
    errors.push('Use "files" instead of "include".');
  } else if ("exclude" in config) {
    errors.push('Use "files" instead of "exclude".');
  } else if (!config.files) {
    errors.push('Must specify "files".');
  } else {
    if (!(config.files.includes("index.d.ts") || config.files.includes("./index.d.ts"))) {
      errors.push('"files" list must include "index.d.ts".');
    }
    // if (!config.files.some((f) => /(?:\.[cm]?ts|\.tsx)$/.test(f) && !isDeclarationPath(f))) {
    //   errors.push('"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.');
    // }
  }

  for (const key of Object.getOwnPropertyNames(mustHave) as (keyof typeof mustHave)[]) {
    const expected = mustHave[key];
    const actual = options[key];
    if (!deepEquals(expected, actual)) {
      errors.push(
        `Expected compilerOptions[${JSON.stringify(key)}] === ${JSON.stringify(expected)}, but got ${JSON.stringify(
          actual,
        )}`,
      );
    }
  }

  for (const key in options) {
    switch (key) {
      case "lib":
      case "noImplicitAny":
      case "noImplicitThis":
      case "strict":
      case "strictNullChecks":
      case "noUncheckedIndexedAccess":
      case "strictFunctionTypes":
      case "esModuleInterop":
      case "allowSyntheticDefaultImports":
      case "target":
      case "jsx":
      case "jsxFactory":
      case "jsxImportSource":
      case "experimentalDecorators":
      case "noUnusedLocals":
      case "noUnusedParameters":
      case "exactOptionalPropertyTypes":
      case "module":
      case "paths":
        break;
      default:
        if (!(key in mustHave)) {
          errors.push(`Unexpected compiler option ${key}`);
        }
    }
  }
  if (!("lib" in options)) {
    errors.push('Must specify "lib", usually to `"lib": ["es6"]` or `"lib": ["es6", "dom"]`.');
  }

  if (!("module" in options)) {
    errors.push('Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.');
  } else if (
    options.module?.toString().toLowerCase() !== "commonjs" &&
    options.module?.toString().toLowerCase() !== "node16"
  ) {
    errors.push(`When "module" is present, it must be set to "commonjs" or "node16".`);
  }

  if ("strict" in options) {
    if (options.strict !== true) {
      errors.push('When "strict" is present, it must be set to `true`.');
    }

    for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks", "strictFunctionTypes"]) {
      if (key in options) {
        throw new TypeError(`Expected "${key}" to not be set when "strict" is \`true\`.`);
      }
    }
  } else {
    for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks", "strictFunctionTypes"]) {
      if (!(key in options)) {
        errors.push(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
      }
    }
  }
  if ("exactOptionalPropertyTypes" in options) {
    if (options.exactOptionalPropertyTypes !== true) {
      errors.push('When "exactOptionalPropertyTypes" is present, it must be set to `true`.');
    }
  }

  if (options.types && options.types.length) {
    errors.push(
      'Use `/// <reference types="..." />` directives in source files and ensure ' +
        'that the "types" field in your tsconfig is an empty array.',
    );
  }
  if (options.paths) {
    for (const key in options.paths) {
      if (options.paths[key].length !== 1) {
        errors.push(`"paths" must map each module specifier to only one file.`);
      }
      const [target] = options.paths[key];
      if (target !== "./index.d.ts") {
        const m = target.match(/^(?:..\/)+([^\/]+)\/(?:v\d+\.?\d*\/)?index.d.ts$/);
        if (!m || m[1] !== key) {
          errors.push(`"paths" must map '${key}' to ${key}'s index.d.ts.`);
        }
      }
    }
  }
  return errors;
}

export async function runAreTheTypesWrong(
  dirName: string,
  dirPath: string,
  implementationPackage: attw.Package,
  configPath: string,
  expectError: boolean,
): Promise<{
  warnings: string[];
  errors: string[];
}> {
  const warnings = [];
  const errors = [];
  let result: {
    status: "pass" | "fail" | "error";
    output: string;
  };

  const tgz = createTgz(dirPath, (err) => {
    throw new Error(`Error creating tarball for ${dirName}: ${err.stack ?? err.message}`);
  });

  const [attw, render, { getExitCode }] = await Promise.all([
    import("@arethetypeswrong/core"),
    import("@arethetypeswrong/cli/internal/render"),
    import("@arethetypeswrong/cli/internal/getExitCode"),
  ]);
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const pkg = implementationPackage.mergedWithTypes(attw.createPackageFromTarballData(await streamToBuffer(tgz)));

  try {
    const checkResult = await attw.checkPackage(pkg);
    if (!checkResult.types) {
      throw new Error("No types found in synthesized attw package");
    }
    const output = await render.typed(checkResult, { format: "auto", ignoreRules: config.ignoreRules });
    const status = getExitCode(checkResult, { ignoreRules: config.ignoreRules }) === 0 ? "pass" : "fail";
    result = { status, output };
  } catch (err: any) {
    result = { status: "error", output: err.stack ?? err.message };
  }

  const { status, output } = result;
  if (expectError) {
    switch (status) {
      case "error":
        // No need to bother anyone with a version mismatch error or non-failure error.
        break;
      case "fail":
        // Show output without failing the build.
        warnings.push(
          `Ignoring attw failure because "${dirName}" is listed in 'failingPackages'.\n\n@arethetypeswrong/cli\n${output}`,
        );
        break;
      case "pass":
        errors.push(`attw passed: remove "${dirName}" from 'failingPackages' in attw.json\n\n${output}`);
        break;
      default:
        assertNever(status);
    }
  } else {
    switch (status) {
      case "error":
      case "fail":
        errors.push(`!@arethetypeswrong/cli\n${output}`);
        break;
      case "pass":
        // Don't show anything for passing attw - most lint rules have no output on success.
        break;
    }
  }

  return { warnings, errors };
}

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
  let packageId;
  try {
    packageId = await retryNon404Errors(() =>
      attw.resolveImplementationPackageForTypesPackage(packageJson.name, `${typesPackageVersion}.9999`, {
        allowDeprecated: true,
      }),
    );
  } catch (err: any) {
    warnings.push(err?.message);
    return { warnings, errors };
  }

  const npmVersionExemptions = await getExpectedNpmVersionFailures();
  if (packageId) {
    const { packageName, packageVersion, tarballUrl } = packageId;
    if (packageJson.nonNpm === true) {
      errors.push(
        `Package ${packageJson.name} is marked as non-npm, but ${packageName} exists on npm. ` +
          `If these types are being added to DefinitelyTyped for the first time, please choose ` +
          `a different name that does not conflict with an existing npm package. If this is an ` +
          `existing conflict, mark these types as \`"nonNpm": "conflict"\`. `,
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

async function retryNon404Errors<T>(action: () => Promise<T>): Promise<T | undefined> {
  let lastError: Error | undefined;
  for (let i = 0; i < 3; i++) {
    try {
      return await action();
    } catch (err: any) {
      if ((err as attw.Npm404Error).kind !== "Npm404Error") {
        lastError = err;
        if (i < 2) await delay(1000);
      } else {
        return undefined;
      }
    }
  }
  throw new Error(
    `Skipping attw due to unexpected error fetching implementation package in multiple attempts. Last error: ${lastError?.stack ?? lastError?.message}`,
  );

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
