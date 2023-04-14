import * as header from "@definitelytyped/header-parser";
import { AllTypeScriptVersion } from "@definitelytyped/typescript-versions";
import { pathExistsSync } from "fs-extra";
import { join as joinPaths } from "path";
import { CompilerOptions } from "typescript";
import { deepEquals } from "@definitelytyped/utils";

import { readJson, packageNameFromPath } from "./util";
// TODO: forbid triple-slash types references like "package/v1"
export function checkPackageJson(dirPath: string, typesVersions: readonly AllTypeScriptVersion[]): header.Header | string[] {
  // TODO: Don't allow package.json except in the root dir of a package and of /v* folders one below the root.
  // (this used to be in dt-header rule, but probably also elsewhere)
  const pkgJsonPath = joinPaths(dirPath, "package.json");
  if (!pathExistsSync(pkgJsonPath)) {
    throw new Error(`${dirPath}: Missing 'package.json'`);
  }
  return header.validatePackageJson(packageNameFromPath(dirPath), joinPaths(dirPath, "package.json"), readJson(pkgJsonPath), typesVersions);
}
/**
 * numbers in `CompilerOptions` might be enum values mapped from strings
 */
export type CompilerOptionsRaw = {
  [K in keyof CompilerOptions]?: CompilerOptions[K] extends number | undefined
    ? string | number | undefined
    : CompilerOptions[K];
};

export interface DefinitelyTypedInfo {
  /** "../" or "../../" or "../../../". This should use '/' even on windows. */
  readonly relativeBaseUrl: string;
}
// TODO: Maybe check ALL of tsconfig, not just compilerOptions
export function checkTsconfig(options: CompilerOptionsRaw): string[] {
  const errors = []
  const mustHave = {
    noEmit: true,
    forceConsistentCasingInFileNames: true,
    types: [],
  };

  for (const key of Object.getOwnPropertyNames(mustHave) as (keyof typeof mustHave)[]) {
    const expected = mustHave[key];
    const actual = options[key];
    if (!deepEquals(expected, actual)) {
      errors.push(
        `Expected compilerOptions[${JSON.stringify(key)}] === ${JSON.stringify(expected)}, but got ${JSON.stringify(
actual
)}`
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
      case "experimentalDecorators":
      case "noUnusedLocals":
      case "noUnusedParameters":
      case "exactOptionalPropertyTypes":
      case "module":
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
  }
  else if (
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
        'that the "types" field in your tsconfig is an empty array.'
    );
  }
  return errors;
}
