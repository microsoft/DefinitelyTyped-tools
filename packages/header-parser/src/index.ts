import { AllTypeScriptVersion, TypeScriptVersion } from "@definitelytyped/typescript-versions";
import assert = require("assert");
import fs = require("fs");
import * as semver from "semver";
import { withoutStart, mapDefined, deepEquals, joinPaths } from "@definitelytyped/utils";

// used in dts-critic
export interface Header {
  readonly nonNpm: boolean | "conflict";
  readonly nonNpmDescription?: string;
  readonly name: string;
  readonly libraryMajorVersion: number;
  readonly libraryMinorVersion: number;
  readonly minimumTypeScriptVersion: AllTypeScriptVersion;
  readonly projects: readonly string[];
  readonly owners: readonly Owner[];
  readonly tsconfigs: readonly string[];
}
// used in definitions-parser
/** Standard package.json `contributor` */
export interface Contributor {
  readonly name: string;
  readonly url: string;
}
/** Additional github-specific form supported on DT. */
export type Owner =
  | Contributor
  | {
      readonly name: string;
      readonly githubUsername: string;
      readonly url?: undefined;
    };

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
  typesDirectoryName: string,
  packageJson: Record<string, unknown>,
  typesVersions: readonly AllTypeScriptVersion[],
): Header | string[] {
  const errors = [];
  const needsTypesVersions = typesVersions.length !== 0;
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
      case "peerDependencies":
      case "projects":
      case "minimumTypeScriptVersion":
      case "owners":
      case "nonNpm":
      case "nonNpmDescription":
      case "pnpm":
      case "tsconfigs":
        break;
      case "typesVersions":
      case "types":
        if (!needsTypesVersions) {
          errors.push(
            `${typesDirectoryName}'s package.json doesn't need to set "${key}" when no 'tsX.X' directories exist.`,
          );
        }
        break;
      default:
        errors.push(`${typesDirectoryName}'s package.json should not include property ${key}`);
    }
  }
  // private
  if (packageJson.private !== true) {
    errors.push(`${typesDirectoryName}'s package.json has bad "private": must be \`"private": true\``);
  }
  // devDependencies
  if (
    typeof packageJson.devDependencies !== "object" ||
    packageJson.devDependencies === null ||
    (packageJson.devDependencies as any)["@types/" + typesDirectoryName] !== "workspace:."
  ) {
    errors.push(
      `${typesDirectoryName}'s package.json has bad "devDependencies": must include \`"@types/${typesDirectoryName}": "workspace:."\``,
    );
  }
  // typesVersions
  if (needsTypesVersions) {
    assert.strictEqual(
      packageJson.types,
      "index",
      `"types" in '${typesDirectoryName}'s package.json' should be "index".`,
    );
    const expected = makeTypesVersionsForPackageJson(typesVersions) as Record<string, object>;
    if (!deepEquals(packageJson.typesVersions, expected)) {
      errors.push(
        `'${typesDirectoryName}'s package.json' has bad "typesVersions". Should be: ${JSON.stringify(
          expected,
          undefined,
          4,
        )}`,
      );
    }
  }

  // building the header object uses a monadic error pattern based on the one in the old header parser
  // It's verbose and repetitive, but I didn't feel like writing a monadic `seq` to be used in only one place.
  let name = "ERROR";
  let libraryMajorVersion = 0;
  let libraryMinorVersion = 0;
  let nonNpm: boolean | "conflict" = false;
  let minimumTypeScriptVersion: AllTypeScriptVersion = TypeScriptVersion.lowest;
  let projects: string[] = [];
  let owners: Owner[] = [];
  let tsconfigs: string[] = [];
  // let files: string[] = [];
  const nameResult = validateName();
  const versionResult = validateVersion();
  const nonNpmResult = validateNonNpm();
  const typeScriptVersionResult = validateTypeScriptVersion();
  const projectsResult = validateProjects();
  const ownersResult = validateOwners();
  const licenseResult = getLicenseFromPackageJson(packageJson.license);
  const tsconfigsResult = validateTsconfigs();
  if (typeof nameResult === "object") {
    errors.push(...nameResult.errors);
  } else {
    name = packageJson.name as string;
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
    minimumTypeScriptVersion = typeScriptVersionResult;
  }
  if ("errors" in projectsResult) {
    errors.push(...projectsResult.errors);
  } else {
    projects = projectsResult;
  }
  if ("errors" in ownersResult) {
    errors.push(...ownersResult.errors);
  } else {
    owners = ownersResult;
  }
  if (Array.isArray(licenseResult)) {
    errors.push(...licenseResult);
  }
  if ("errors" in tsconfigsResult) {
    errors.push(...tsconfigsResult.errors);
  } else {
    tsconfigs = tsconfigsResult;
  }
  if (errors.length) {
    return errors;
  } else {
    return {
      name,
      libraryMajorVersion,
      libraryMinorVersion,
      nonNpm,
      minimumTypeScriptVersion,
      projects,
      owners,
      tsconfigs,
    };
  }

  function validateName(): string | { errors: string[] } {
    if (packageJson.name !== "@types/" + typesDirectoryName) {
      return {
        errors: [`${typesDirectoryName}'s package.json should have \`"name": "@types/${typesDirectoryName}"\``],
      };
    } else {
      return typesDirectoryName;
    }
  }
  function validateVersion(): { major: number; minor: number } | { errors: string[] } {
    const errors = [];
    if (!packageJson.version || typeof packageJson.version !== "string") {
      errors.push(
        `${typesDirectoryName}'s package.json should have \`"version"\` matching the version of the implementation package.`,
      );
    } else {
      const version = semver.parse(packageJson.version);
      if (version === null) {
        errors.push(
          `${typesDirectoryName}'s package.json has bad "version": ${JSON.stringify(
            packageJson.version,
          )} should look like "NN.NN.9999"`,
        );
      } else if (version.patch !== 9999) {
        errors.push(`${typesDirectoryName}'s package.json has bad "version": ${version} must end with ".9999"`);
      } else {
        return { major: version.major, minor: version.minor };
      }
    }
    return { errors };
  }
  function validateNonNpm(): boolean | "conflict" | { errors: string[] } {
    const errors = [];
    if (packageJson.nonNpm !== undefined) {
      if (packageJson.nonNpm !== true && packageJson.nonNpm !== "conflict") {
        errors.push(`${typesDirectoryName}'s package.json has bad "nonNpm": must be true or "conflict" if present.`);
      } else if (!packageJson.nonNpmDescription) {
        errors.push(
          `${typesDirectoryName}'s package.json has missing "nonNpmDescription", which is required with "nonNpm": true.`,
        );
      } else if (typeof packageJson.nonNpmDescription !== "string") {
        errors.push(`${typesDirectoryName}'s package.json has bad "nonNpmDescription": must be a string if present.`);
      } else {
        return packageJson.nonNpm;
      }
      return { errors };
    } else if (packageJson.nonNpmDescription !== undefined) {
      errors.push(`${typesDirectoryName}'s package.json has "nonNpmDescription" without "nonNpm": true.`);
    }
    if (errors.length) {
      return { errors };
    } else {
      return false;
    }
  }
  function validateTypeScriptVersion(): AllTypeScriptVersion | { errors: string[] } {
    if (packageJson.minimumTypeScriptVersion) {
      if (
        typeof packageJson.minimumTypeScriptVersion !== "string" ||
        !TypeScriptVersion.isTypeScriptVersion(packageJson.minimumTypeScriptVersion)
      ) {
        return {
          errors: [
            `${typesDirectoryName}'s package.json has bad "minimumTypeScriptVersion": if present, must be a MAJOR.MINOR semver string up to "${TypeScriptVersion.latest}".
(Defaults to "${TypeScriptVersion.lowest}" if not provided.)`,
          ],
        };
      } else {
        return packageJson.minimumTypeScriptVersion;
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
        `${typesDirectoryName}'s package.json has bad "projects": must be an array of strings that point to the project web site(s).`,
      );
    } else if (packageJson.projects.length === 0) {
      errors.push(`${typesDirectoryName}'s package.json has bad "projects": must have at least one project URL.`);
    } else {
      return packageJson.projects;
    }
    return { errors };
  }
  function validateOwners(): Owner[] | { errors: string[] } {
    const errors: string[] = [];
    if (!packageJson.owners || !Array.isArray(packageJson.owners)) {
      errors.push(
        `${typesDirectoryName}'s package.json has bad "owners": must be an array of type Array<{ name: string, url: string, githubUsername: string}>.`,
      );
    } else {
      const es = checkPackageJsonOwners(typesDirectoryName, packageJson.owners);
      if (es.length) {
        errors.push(...es);
      } else {
        return packageJson.owners as Owner[];
      }
    }
    return { errors };
  }
  function validateTsconfigs(): string[] | { errors: string[] } {
    const errors: string[] = [];
    if (packageJson.tsconfigs === undefined) {
      return ["tsconfig.json"];
    }
    if (!Array.isArray(packageJson.tsconfigs)) {
      errors.push(
        `${typesDirectoryName}'s package.json has bad "tsconfigs": must be an array of strings that point to the tsconfig file(s).`,
      );
    } else {
      for (const tsconfig of tsconfigs) {
        if (typeof tsconfig !== "string") {
          errors.push(
            `${typesDirectoryName}'s package.json has bad "tsconfigs": must be an array of strings that point to the tsconfig file(s).`,
          );
          continue;
        }
        if (tsconfig === "tsconfig.json") continue;

        if (!tsconfig.startsWith("tsconfig.") || !tsconfig.endsWith(".json")) {
          errors.push(
            `${typesDirectoryName}'s package.json has bad "tsconfigs": ${tsconfig} is not a valid tsconfig file name; should match "tsconfig.*.json"`,
          );
        }
      }
      return packageJson.tsconfigs;
    }
    return { errors };
  }
}

export function getTypesVersions(dirPath: string): readonly AllTypeScriptVersion[] {
  return mapDefined(fs.readdirSync(dirPath), (name) => {
    if (name === "tsconfig.json") {
      return undefined;
    }
    const version = withoutStart(name, "ts");
    if (version === undefined || !fs.statSync(joinPaths(dirPath, name)).isDirectory()) {
      return undefined;
    }

    if (!TypeScriptVersion.isTypeScriptVersion(version)) {
      throw new Error(`There is an entry named ${name}, but ${version} is not a valid TypeScript version.`);
    }
    // if (!TypeScriptVersion.isSupported(version)) {
    //   throw new Error(`At ${dirPath}/${name}: TypeScript version ${version} is not supported on Definitely Typed.`);
    // }
    return version;
  });
}
function checkPackageJsonOwners(packageName: string, packageJsonOwners: readonly unknown[]) {
  const errors: string[] = [];
  for (const c of packageJsonOwners) {
    if (typeof c !== "object" || c === null) {
      errors.push(
        `${packageName}'s package.json has bad "owners": must be an array of type Array<{ name: string, url: string } | { name: string, githubUsername: string}>.`,
      );
      continue;
    }
    if (!("name" in c) || typeof c.name !== "string") {
      errors.push(`${packageName}'s package.json has bad "name" in owner ${JSON.stringify(c)}
Must be an object of type { name: string, url: string } | { name: string, githubUsername: string}.`);
    } else if (c.name === "My Self") {
      errors.push(`${packageName}'s package.json has bad "name" in owner ${JSON.stringify(c)}
Author name should be your name, not the default.`);
    }
    if ("githubUsername" in c) {
      if (typeof c.githubUsername !== "string") {
        errors.push(`${packageName}'s package.json has bad "githubUsername" in owner ${JSON.stringify(c)}
Must be an object of type { name: string, url: string } | { name: string, githubUsername: string}.`);
      } else if ("url" in c) {
        errors.push(
          `${packageName}'s package.json has bad owner: should not have both "githubUsername" and "url" properties in owner ${JSON.stringify(
            c,
          )}`,
        );
      }
    } else if ("url" in c && typeof c.url !== "string") {
      errors.push(`${packageName}'s package.json has bad "url" in owner ${JSON.stringify(c)}
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
            `${packageName}'s package.json has bad owner: should not include property ${key} in ${JSON.stringify(c)}`,
          );
      }
    }
  }
  return errors;
}

// Note that BSD is not supported -- for that, we'd have to choose a *particular* BSD license from the list at https://spdx.org/licenses/
export const enum License {
  MIT = "MIT",
  Apache20 = "Apache-2.0",
}
const allLicenses = [License.MIT, License.Apache20];
export function getLicenseFromPackageJson(packageJsonLicense: unknown): License | string[] {
  if (packageJsonLicense === undefined) {
    return License.MIT;
  }
  if (typeof packageJsonLicense === "string" && packageJsonLicense === "MIT") {
    return [`Specifying '"license": "MIT"' is redundant, this is the default.`];
  }
  if (allLicenses.includes(packageJsonLicense as License)) {
    return packageJsonLicense as License;
  }
  return [
    `'package.json' license is ${JSON.stringify(packageJsonLicense)}.\nExpected one of: ${JSON.stringify(
      allLicenses,
    )}}`,
  ];
}
// TODO: Move these checks into validatePackageJson and make it return an entire package.json type, not just Header
// TODO: Expand these checks too, adding name and version just like dtslint
export function checkPackageJsonExportsAndAddPJsonEntry(exports: unknown, path: string) {
  if (exports === undefined) return exports;
  if (typeof exports === "string") {
    return exports;
  }
  if (typeof exports !== "object") {
    return [`Package exports at path ${path} should be an object or string.`];
  }
  if (exports === null) {
    return [`Package exports at path ${path} should not be null.`];
  }
  if (!(exports as Record<string, unknown>)["./package.json"]) {
    (exports as Record<string, unknown>)["./package.json"] = "./package.json";
  }
  return exports;
}

export function checkPackageJsonImports(imports: unknown, path: string): object | string[] | undefined {
  if (imports === undefined) return imports;
  if (typeof imports !== "object") {
    return [`Package imports at path ${path} should be an object or string.`];
  } else if (imports === null) {
    return [`Package imports at path ${path} should not be null.`];
  }
  return imports;
}

export function checkPackageJsonType(type: unknown, path: string) {
  if (type === undefined) return type;
  if (type !== "module") {
    return [`Package type at path ${path} can only be 'module'.`];
  }
  return type;
}

/**
 * @param devDependencySelfName - pass the package name only for devDependencies
 */
export function checkPackageJsonDependencies(
  dependencies: unknown,
  path: string,
  allowedDependencies: ReadonlySet<string>,
  devDependencySelfName?: string,
): string[] {
  if (dependencies === undefined) {
    return [];
  }
  if (dependencies === null || typeof dependencies !== "object") {
    return [`${path} should contain ${devDependencySelfName ? "devDependencies" : "dependencies"} or not exist.`];
  }

  const errors: string[] = [];
  for (const dependencyName of Object.keys(dependencies)) {
    if (!dependencyName.startsWith("@types/") && !allowedDependencies.has(dependencyName)) {
      const msg = `Dependency ${dependencyName} not in the allowed dependencies list.
Please make a pull request to microsoft/DefinitelyTyped-tools adding it to \`packages/definitions-parser/allowedPackageJsonDependencies.txt\`.`;
      errors.push(`In ${path}: ${msg}`);
    }
    const version = (dependencies as { [key: string]: unknown })[dependencyName];
    if (typeof version !== "string") {
      errors.push(`In ${path}: Dependency version for ${dependencyName} should be a string.`);
    }
  }
  if (devDependencySelfName) {
    const selfDependency = (dependencies as { [key: string]: string | undefined })[devDependencySelfName];
    if (selfDependency === undefined || selfDependency !== "workspace:.") {
      errors.push(
        `In ${path}: devDependencies must contain a self-reference to the current package like  ${JSON.stringify(
          devDependencySelfName,
        )}: "workspace:."`,
      );
    }
  }
  return errors;
}
