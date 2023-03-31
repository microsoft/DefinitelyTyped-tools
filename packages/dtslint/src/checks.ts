import { makeTypesVersionsForPackageJson } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import assert = require("assert");
import { pathExistsSync } from "fs-extra";
import { join as joinPaths } from "path";
import { CompilerOptions } from "typescript";

import { readJson, packageNameFromPath } from "./util";
export function checkPackageJson(dirPath: string, typesVersions: readonly TypeScriptVersion[]): string[] {
  const pkgJsonPath = joinPaths(dirPath, "package.json");
  if (!pathExistsSync(pkgJsonPath)) {
    throw new Error(`${dirPath}: Missing 'package.json'`);
  }
  return checkPackageJsonContents(dirPath, readJson(pkgJsonPath), typesVersions);
}

export function checkPackageJsonContents(dirPath: string, pkgJson: Record<string, unknown>, typesVersions: readonly TypeScriptVersion[]): string[] {
  const errors = []
  const pkgJsonPath = joinPaths(dirPath, "package.json");
  const packageName = packageNameFromPath(dirPath);
  const needsTypesVersions = typesVersions.length !== 0;
  if (pkgJson.private !== true) {
    errors.push(`${pkgJsonPath} should have \`"private": true\``)
  }
  if (pkgJson.name !== "@types/" + packageName) {
    errors.push(`${pkgJsonPath} should have \`"name": "@types/${packageName}"\``);
  }
  if (typeof pkgJson.devDependencies !== "object"
    || pkgJson.devDependencies === null
    || (pkgJson.devDependencies as any)["@types/" + packageName] !== "workspace:.") {
    errors.push(`In ${pkgJsonPath}, devDependencies must include \`"@types/${packageName}": "workspace:."\``);
  }
  if (!pkgJson.version || typeof pkgJson.version !== "string") {
    errors.push(`${pkgJsonPath} should have \`"version"\` matching the version of the implementation package.`);
  }
  else if (!/\d+\.\d+\.\d+/.exec(pkgJson.version)) {
    errors.push(`${pkgJsonPath} has bad "version": should look like "NN.NN.0"`);
  }
  else if (!pkgJson.version.endsWith(".0")) {
    errors.push(`${pkgJsonPath} has bad "version": must end with ".0"`);
  }

  if (needsTypesVersions) {
    assert.strictEqual(pkgJson.types, "index", `"types" in '${pkgJsonPath}' should be "index".`);
    const expected = makeTypesVersionsForPackageJson(typesVersions) as Record<string, object>;
    if (!deepEquals(pkgJson.typesVersions, expected)) {
      errors.push(`"typesVersions" in '${pkgJsonPath}' is not set right. Should be: ${JSON.stringify(expected, undefined, 4)}`)
    }
  }
  // TODO: Test on a toplevel package, a scoped package, and old-version package, and an old-TS-version package
  for (const key in pkgJson) {
    // tslint:disable-line forin
    switch (key) {
      case "private":
      case "dependencies":
      case "license":
      case "imports":
      case "exports":
      case "type":
      case "name":
      case "version":
      case "devDependencies":
        // "private"/"typesVersions"/"types"/"name"/"version" checked above, "dependencies" / "license" checked by types-publisher,
        // TODO: asserts for above in types-publisher
        break;
      case "typesVersions":
      case "types":
        if (!needsTypesVersions) {
          errors.push(`${pkgJsonPath} doesn't need to set "${key}" when no 'ts3.x' directories exist.`);
        }
        break;
      default:
        errors.push(`${pkgJsonPath} should not include field ${key}`);
    }
  }
  return errors
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
export function checkTsconfig(options: CompilerOptionsRaw, dt: boolean): string[] {
  const errors = []
  if (dt) {
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

function deepEquals(expected: unknown, actual: unknown): boolean {
  if (expected instanceof Array) {
    return (
      actual instanceof Array && actual.length === expected.length && expected.every((e, i) => deepEquals(e, actual[i]))
    );
  } else {
    return expected === actual;
  }
}
