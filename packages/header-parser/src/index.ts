import { AllTypeScriptVersion, TypeScriptVersion } from "@definitelytyped/typescript-versions";
import assert = require("assert");
import { deepEquals, parsePackageSemver } from "@definitelytyped/utils";

// TODO:
// 1. Convert this package into a packageJson checker
// 2. Move checks from dt-header into dtslint/checks.ts and remove the rule.
// 4. Add test for header in dtslint that forbids it.
// 5. Update dts-gen and DT README and ??? -- rest of ecosystem.
/*

  # Example header format #

  // Type definitions for foo 1.2
  // Project: https://github.com/foo/foo, https://foo.com
  // Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
  // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
  // TypeScript Version: 2.1

*/
// used in dts-critic
export interface Header {
  readonly nonNpm: boolean;
  readonly libraryName: string;
  readonly libraryMajorVersion: number;
  readonly libraryMinorVersion: number;
  readonly typeScriptVersion: AllTypeScriptVersion;
  readonly projects: readonly string[];
  readonly contributors: readonly Author[];
}
// used in definitions-parser
export interface Author {
  readonly name: string;
  readonly url: string;
  readonly githubUsername: string | undefined;
}
// used locally
export interface ParseError {
  readonly index: number;
  readonly line: number;
  readonly column: number;
  readonly expected: readonly string[];
}

export function makeTypesVersionsForPackageJson(typesVersions: readonly AllTypeScriptVersion[]): unknown {
  if (typesVersions.length === 0) {
    return undefined;
  }

  const oldestFirst = typesVersions.slice();
  oldestFirst.sort((v1, v2) => (v1 > v2 ? 1 : v1 < v2 ? -1 : 0));
  const out: { [key: string]: { readonly "*": readonly string[] } } = {};
  for (const version of oldestFirst) {
    out[`<=${version}`] = { "*": [`ts${version}/*`] };
  }
  return out;
}

export function validatePackageJson(
  packageName: string,
  packageJson: Record<string, unknown>,
  typesVersions: readonly AllTypeScriptVersion[]
): Header | string[] {
  const errors = [];
  const needsTypesVersions = typesVersions.length !== 0;
  // NOTE: I had to install eslint-plugin-import in DT because DT-tools hasn't shipped a new version
  // DONE: normal package: 3box
  // DONE: scoped package: adeira__js
  // DONE: old-version package: gulp/v3
  // DONE: old-TS-version package: har-format
  // DONE: react
  // DONE: node
  for (const key in packageJson) {
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
      case "projects":
      case "typeScriptVersion":
      case "contributors":
      case "nonNpm":
      case "nonNpmDescription":
        // "dependencies" / "license" checked by types-publisher,
        // TODO: asserts for other fields in types-publisher
        break;
      case "paths":
      case "pnpm":
        // TODO: write validation rules for pnpm property (should just be overrides, and those should probably be restricted somehow)
        // TODO: write validation rules for paths property (based on old version's checks?)
        break;
      case "typesVersions":
      case "types":
        if (!needsTypesVersions) {
          errors.push(`${packageName}'s package.json doesn't need to set "${key}" when no 'ts4.x' directories exist.`);
        }
        break;
      default:
        errors.push(`${packageName}'s package.json should not include property ${key}`);
    }
  }
  // private
  if (packageJson.private !== true) {
    errors.push(`${packageName}'s package.json has bad "private": must be \`"private": true\``);
  }
  // devDependencies
  if (
    typeof packageJson.devDependencies !== "object" ||
    packageJson.devDependencies === null ||
    (packageJson.devDependencies as any)["@types/" + packageName] !== "workspace:."
  ) {
    errors.push(
      `${packageName}'s package.json has bad "devDependencies": must include \`"@types/${packageName}": "workspace:."\``
    );
  }
  // TODO: disallow devDeps from containing dependencies (although this is VERY linty)
  // TODO: Check that devDeps are NOT used in .d.ts files

  // typesVersions
  if (needsTypesVersions) {
    assert.strictEqual(packageJson.types, "index", `"types" in '${packageName}'s package.json' should be "index".`);
    const expected = makeTypesVersionsForPackageJson(typesVersions) as Record<string, object>;
    if (!deepEquals(packageJson.typesVersions, expected)) {
      errors.push(
        `'${packageName}'s package.json' has bad "typesVersions". Should be: ${JSON.stringify(expected, undefined, 4)}`
      );
    }
  }

  // building the header object uses a monadic error pattern based on the one in the old header parser
  // It's verbose and repetitive, but I didn't feel like writing a monadic `seq` to be used in only one place.
  let libraryName = "ERROR";
  let libraryMajorVersion = 0;
  let libraryMinorVersion = 0;
  let nonNpm = false;
  let typeScriptVersion: AllTypeScriptVersion = TypeScriptVersion.lowest;
  let projects: string[] = [];
  let contributors: Author[] = [];
  const nameResult = validateName();
  const versionResult = validateVersion();
  const nonNpmResult = validateNonNpm();
  const typeScriptVersionResult = validateTypeScriptVersion();
  const projectsResult = validateProjects();
  const contributorsResult = validateContributors();
  if (typeof nameResult === "object") {
    errors.push(...nameResult.errors);
  } else {
    libraryName = packageName;
  }
  if ("errors" in versionResult) {
    errors.push(...versionResult.errors);
  } else {
    libraryMajorVersion = versionResult.major;
    libraryMinorVersion = versionResult.minor;
  }
  if (typeof nonNpmResult === "object") {
    errors.push(...nonNpmResult.errors);
  } else {
    nonNpm = nonNpmResult;
  }
  if (typeof typeScriptVersionResult === "object") {
    errors.push(...typeScriptVersionResult.errors);
  } else {
    typeScriptVersion = typeScriptVersionResult;
  }
  if ("errors" in projectsResult) {
    errors.push(...projectsResult.errors);
  } else {
    projects = projectsResult;
  }
  if ("errors" in contributorsResult) {
    errors.push(...contributorsResult.errors);
  } else {
    contributors = contributorsResult;
  }
  if (errors.length) {
    return errors;
  } else {
    return {
      libraryName,
      libraryMajorVersion,
      libraryMinorVersion,
      nonNpm,
      typeScriptVersion,
      projects,
      contributors,
    };
  }

  function validateName(): string | { errors: string[] } {
    if (packageJson.name !== "@types/" + packageName) {
      return { errors: [`${packageName}'s package.json should have \`"name": "@types/${packageName}"\``] };
    } else {
      return packageName;
    }
  }
  function validateVersion(): { major: number; minor: number } | { errors: string[] } {
    const errors = [];
    if (!packageJson.version || typeof packageJson.version !== "string") {
      errors.push(
        `${packageName}'s package.json should have \`"version"\` matching the version of the implementation package.`
      );
    } else if (!/\d+\.\d+\.\d+/.exec(packageJson.version)) {
      errors.push(`${packageName}'s package.json has bad "version": should look like "NN.NN.99999"`);
    } else if (!packageJson.version.endsWith(".99999")) {
      errors.push(`${packageName}'s package.json has bad "version": must end with ".99999"`);
    } else {
      let version: "*" | { major: number; minor?: number } = "*";
      try {
        version = parsePackageSemver(packageJson.version);
        if (version === "*") {
          errors.push("Failed to parse version");
        } else {
          // TODO: parseSemverPackage will eventually return a real semver, which always has minor filled in
          return { major: version.major, minor: version.minor ?? 0 };
        }
      } catch (e: any) {
        errors.push(`'${packageName}'s package.json' has bad "version": Semver parsing failed with '${e.message}'`);
      }
    }
    return { errors };
  }
  function validateNonNpm(): boolean | { errors: string[] } {
    const errors = [];
    if (packageJson.nonNpm !== undefined) {
      if (packageJson.nonNpm !== true) {
        errors.push(`${packageName}'s package.json has bad "nonNpm": must be true if present.`);
      } else if (!packageJson.nonNpmDescription) {
        errors.push(
          `${packageName}'s package.json has missing "nonNpmDescription", which is required with "nonNpm": true.`
        );
      } else if (typeof packageJson.nonNpmDescription !== "string") {
        errors.push(`${packageName}'s package.json has bad "nonNpmDescription": must be a string if present.`);
      } else {
        return true;
      }
      return { errors };
    } else if (packageJson.nonNpmDescription !== undefined) {
      errors.push(`${packageName}'s package.json has "nonNpmDescription" without "nonNpm": true.`);
    }
    if (errors.length) {
      return { errors };
    } else {
      return false;
    }
  }
  function validateTypeScriptVersion(): AllTypeScriptVersion | { errors: string[] } {
    if (packageJson.typeScriptVersion) {
      if (
        typeof packageJson.typeScriptVersion !== "string" ||
        !TypeScriptVersion.isTypeScriptVersion(packageJson.typeScriptVersion)
      ) {
        return {
          errors: [
            `${packageName}'s package.json has bad "typeScriptVersion": if present, must be a MAJOR.MINOR semver string up to "${TypeScriptVersion.latest}".
(Defaults to "${TypeScriptVersion.lowest}" if not provided.)`,
          ],
        };
      } else {
        return packageJson.typeScriptVersion;
      }
    }
    return TypeScriptVersion.lowest;
  }
  function validateProjects(): string[] | { errors: string[] } {
    const errors = [];
    if (
      !packageJson.projects ||
      !Array.isArray(packageJson.projects) ||
      !packageJson.projects.every((p) => typeof p === "string")
    ) {
      errors.push(
        `${packageName}'s package.json has bad "projects": must be an array of strings that point to the project web site(s).`
      );
    } else if (packageJson.projects.length === 0) {
      errors.push(`${packageName}'s package.json has bad "projects": must have at least one project URL.`);
    } else {
      return packageJson.projects;
    }
    return { errors };
  }
  function validateContributors(): Author[] | { errors: string[] } {
    const errors: string[] = [];
    if (!packageJson.contributors || !Array.isArray(packageJson.contributors)) {
      errors.push(
        `${packageName}'s package.json has bad "contributors": must be an array of type Array<{ name: string, url: string, githubUsername: string}>.`
      );
    } else {
      const es = checkPackageJsonContributors(packageName, packageJson.contributors);
      if (es.length) {
        errors.push(...es);
      } else {
        return packageJson.contributors as Author[];
      }
    }
    return { errors };
  }
}

function checkPackageJsonContributors(packageName: string, packageJsonContributors: readonly unknown[]) {
  const errors: string[] = [];
  for (const c of packageJsonContributors) {
    if (typeof c !== "object" || c === null) {
      errors.push(
        `${packageName}'s package.json has bad "contributors": must be an array of type Array<{ name: string, url: string } | { name: string, githubUsername: string}>.`
      );
      continue;
    }
    if (!("name" in c) || typeof c.name !== "string") {
      errors.push(`${packageName}'s package.json has bad "name" in contributor ${JSON.stringify(c)}
Must be an object of type { name: string, url: string } | { name: string, githubUsername: string}.`);
    } else if (c.name === "My Self") {
      errors.push(`${packageName}'s package.json has bad "name" in contributor ${JSON.stringify(c)}
Author name should be your name, not the default.`);
    }
    if ("githubUsername" in c) {
      if (typeof c.githubUsername !== "string") {
        errors.push(`${packageName}'s package.json has bad "githubUsername" in contributor ${JSON.stringify(c)}
Must be an object of type { name: string, url: string } | { name: string, githubUsername: string}.`);
      } else if ("url" in c) {
        errors.push(
          `${packageName}'s package.json has bad contributor: should not have both "githubUsername" and "url" properties in contributor ${JSON.stringify(
            c
          )}`
        );
      }
    } else if ("url" in c && typeof c.url !== "string") {
      errors.push(`${packageName}'s package.json has bad "url" in contributor ${JSON.stringify(c)}
Must be an object of type { name: string, url: string } | { name: string, githubUsername: string}.`);
    }
    for (const key in c) {
      switch (key) {
        case "name":
        case "url":
        case "githubUsername":
          break;
        default:
          errors.push(
            `${packageName}'s package.json has bad contributor: should not include property ${key} in ${JSON.stringify(
              c
            )}`
          );
      }
    }
  }
  return errors;
}
