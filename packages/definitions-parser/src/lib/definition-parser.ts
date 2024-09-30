import {
  License,
  checkPackageJsonDependencies,
  checkPackageJsonExportsAndAddPJsonEntry,
  checkPackageJsonImports,
  checkPackageJsonType,
  getLicenseFromPackageJson,
  validatePackageJson,
} from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { FS, assertDefined, atTypesSlash, isDeclarationPath, split } from "@definitelytyped/utils";
import assert from "assert";
import {
  DirectoryParsedTypingVersion,
  TypingsData,
  TypingsDataRaw,
  TypingsVersionsRaw,
  formatTypingVersion,
  getMangledNameForScopedPackage,
} from "../packages";
import { getAllowedPackageJsonDependencies } from "./settings";

function matchesVersion(
  typingsDataRaw: TypingsDataRaw,
  version: DirectoryParsedTypingVersion,
  considerLibraryMinorVersion: boolean,
) {
  return (
    typingsDataRaw.header.libraryMajorVersion === version.major &&
    (considerLibraryMinorVersion
      ? version.minor === undefined || typingsDataRaw.header.libraryMinorVersion === version.minor
      : true)
  );
}

function formattedLibraryVersion(typingsDataRaw: TypingsDataRaw): `${number}.${number}` {
  return `${typingsDataRaw.header.libraryMajorVersion}.${typingsDataRaw.header.libraryMinorVersion}`;
}

export async function getTypingInfo(
  packageNameOrTypesDirectoryName: string,
  dt: FS,
): Promise<TypingsVersionsRaw | undefined | { errors: string[] }> {
  const errors = [];
  if (packageNameOrTypesDirectoryName !== packageNameOrTypesDirectoryName.toLowerCase()) {
    errors.push(`Package name \`${packageNameOrTypesDirectoryName}\` should be strictly lowercase`);
  }
  interface OlderVersionDir {
    readonly directoryName: string;
    readonly version: DirectoryParsedTypingVersion;
  }

  const typesDirectoryName = getMangledNameForScopedPackage(packageNameOrTypesDirectoryName);
  if (!dt.subDir("types").exists(typesDirectoryName) || !dt.subDir("types").isDirectory(typesDirectoryName)) {
    return undefined;
  }

  const fs = dt.subDir("types").subDir(typesDirectoryName);
  const [rootDirectoryLs, olderVersionDirectories] = split<string, OlderVersionDir>(
    fs.readdir(),
    (fileOrDirectoryName) => {
      const version = parseVersionFromDirectoryName(fileOrDirectoryName);
      return version === undefined ? undefined : { directoryName: fileOrDirectoryName, version };
    },
  );

  const considerLibraryMinorVersion = olderVersionDirectories.some(({ version }) => version.minor !== undefined);
  const latestDataResult = await getPackageJsonInfoForPackage(
    packageNameOrTypesDirectoryName,
    rootDirectoryLs,
    fs,
    olderVersionDirectories.map(({ directoryName }) => directoryName),
  );
  if (Array.isArray(latestDataResult)) {
    return { errors: [...errors, ...latestDataResult] };
  }
  const latestData: TypingsDataRaw = { libraryVersionDirectoryName: undefined, ...latestDataResult };

  const older = await Promise.all(
    olderVersionDirectories.map(async ({ directoryName, version: directoryVersion }) => {
      if (matchesVersion(latestData, directoryVersion, considerLibraryMinorVersion)) {
        const latest = `${latestData.header.libraryMajorVersion}.${latestData.header.libraryMinorVersion}`;
        errors.push(
          `The latest version of the '${packageNameOrTypesDirectoryName}' package is ${latest}, so the subdirectory '${directoryName}' is not allowed` +
            (`v${latest}` === directoryName
              ? "."
              : `; since it applies to any ${latestData.header.libraryMajorVersion}.* version, up to and including ${latest}.`),
        );
      }

      const ls = fs.readdir(directoryName);
      const result = await getPackageJsonInfoForPackage(
        packageNameOrTypesDirectoryName,
        ls,
        fs.subDir(directoryName),
        [],
      );
      if (Array.isArray(result)) {
        errors.push(...result);
        return result;
      }
      const data: TypingsDataRaw = { libraryVersionDirectoryName: formatTypingVersion(directoryVersion), ...result };

      if (!matchesVersion(data, directoryVersion, considerLibraryMinorVersion)) {
        if (considerLibraryMinorVersion) {
          errors.push(
            `Directory ${directoryName} indicates major.minor version ${directoryVersion.major}.${
              directoryVersion.minor ?? "*"
            }, ` +
              `but package.json indicates major.minor version ${data.header.libraryMajorVersion}.${data.header.libraryMinorVersion}`,
          );
        } else {
          errors.push(
            `Directory ${directoryName} indicates major version ${directoryVersion.major}, but package.json indicates major version ` +
              data.header.libraryMajorVersion.toString(),
          );
        }
      }
      return data;
    }),
  );
  if (errors.length) {
    return { errors };
  }

  const res: TypingsVersionsRaw = {};
  res[formattedLibraryVersion(latestData)] = latestData;
  for (const o of older) {
    assert(!Array.isArray(o));
    res[formattedLibraryVersion(o as TypingsDataRaw)] = o;
  }
  return res;
}

const packageJsonName = "package.json";

interface LsMinusTypesVersionsAndPackageJson {
  readonly remainingLs: readonly string[];
  readonly typesVersions: readonly TypeScriptVersion[];
}
function getTypesVersionsAndPackageJson(ls: readonly string[]): LsMinusTypesVersionsAndPackageJson | string[] {
  const errors: string[] = [];
  const withoutPackageJson = ls.filter((name) => name !== packageJsonName);
  const [remainingLs, typesVersions] = split(withoutPackageJson, (fileOrDirectoryName) => {
    const match = /^ts(\d+\.\d+)$/.exec(fileOrDirectoryName);
    if (match === null) {
      return undefined;
    }

    const version = match[1];
    if (parseInt(version, 10) < 3) {
      errors.push(`Directory name starting with 'ts' should be a TypeScript version newer than 3.0. Got: ${version}`);
    }
    return version as TypeScriptVersion;
  });
  if (errors.length) {
    return errors;
  }
  return { remainingLs, typesVersions };
}

/**
 * Parses a directory name into a version that either holds a single major version or a major and minor version.
 *
 * @example
 *
 * ```ts
 * parseVersionFromDirectoryName("v1") // { major: 1 }
 * parseVersionFromDirectoryName("v0.61") // { major: 0, minor: 61 }
 * ```
 */
export function parseVersionFromDirectoryName(
  directoryName: string | undefined,
): DirectoryParsedTypingVersion | undefined {
  const match = /^v(\d+)(\.(\d+))?$/.exec(directoryName!);
  if (match === null) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: match[3] !== undefined ? Number(match[3]) : undefined,
  };
}

async function getPackageJsonInfoForPackage(
  typingsPackageName: string,
  ls: readonly string[],
  fs: FS,
  olderVersionDirectories: readonly string[],
): Promise<Omit<TypingsDataRaw, "libraryVersionDirectoryName"> | string[]> {
  const errors = [];
  const typesVersionAndPackageJson = getTypesVersionsAndPackageJson(ls);
  if (Array.isArray(typesVersionAndPackageJson)) {
    errors.push(...typesVersionAndPackageJson);
  }
  const { typesVersions } = Array.isArray(typesVersionAndPackageJson)
    ? { typesVersions: [] }
    : typesVersionAndPackageJson;
  const packageJson = fs.readJson(packageJsonName) as {
    readonly license?: unknown;
    readonly dependencies?: unknown;
    readonly peerDependencies?: unknown;
    readonly devDependencies?: unknown;
    readonly imports?: unknown;
    readonly exports?: unknown;
    readonly type?: unknown;
  };

  const packageJsonType = checkPackageJsonType(packageJson.type, packageJsonName);
  if (Array.isArray(packageJsonType)) {
    errors.push(...packageJsonType);
  }
  const packageJsonResult = validatePackageJson(typingsPackageName, packageJson, typesVersions);
  if (Array.isArray(packageJsonResult)) {
    errors.push(...packageJsonResult);
  }

  const header = Array.isArray(packageJsonResult) ? undefined : packageJsonResult;
  const allowedDependencies = await getAllowedPackageJsonDependencies();
  errors.push(...checkPackageJsonDependencies(packageJson.dependencies, packageJsonName, allowedDependencies));
  errors.push(...checkPackageJsonDependencies(packageJson.peerDependencies, packageJsonName, allowedDependencies));
  errors.push(
    ...checkPackageJsonDependencies(
      packageJson.devDependencies,
      packageJsonName,
      allowedDependencies,
      `${atTypesSlash}${typingsPackageName}`,
    ),
  );
  const imports = checkPackageJsonImports(packageJson.imports, packageJsonName);
  if (Array.isArray(imports)) {
    errors.push(...imports);
  }
  const exports = checkPackageJsonExportsAndAddPJsonEntry(packageJson.exports, packageJsonName);
  if (Array.isArray(exports)) {
    errors.push(...exports);
  }
  const license = getLicenseFromPackageJson(packageJson.license);
  if (Array.isArray(license)) {
    errors.push(...license);
  }
  if (errors.length) {
    return errors;
  }

  // Note that only the first project is collected right now
  return {
    header: assertDefined(header),
    typesVersions,
    license: license as License,
    dependencies: packageJson.dependencies as Record<string, string>,
    devDependencies: packageJson.devDependencies as Record<string, string>,
    peerDependencies: packageJson.peerDependencies as Record<string, string> | undefined,
    imports: imports as object | undefined,
    exports: exports as string | object | undefined,
    type: packageJsonType as "module" | undefined,
    olderVersionDirectories,
  };
}

export function getFiles(
  dt: FS,
  typingsData: TypingsData,
  olderVersionDirectories: readonly string[],
): readonly string[] {
  const rootDir = dt.subDir("types").subDir(typingsData.subDirectoryPath);

  const files: string[] = [];
  function addFileIfDeclaration(path: string): void {
    if (isDeclarationPath(path)) {
      files.push(path);
    }
  }

  function addFiles(root: FS, rootName: string, name: string): void {
    const path = rootName ? `${rootName}/${name}` : name;

    if (!root.isDirectory(name)) {
      addFileIfDeclaration(path);
      return;
    }

    const newRoot = root.subDir(name);
    for (const sub of root.readdir(name)) {
      addFiles(newRoot, path, sub);
    }
  }

  for (const name of rootDir.readdir()) {
    if (rootDir.isDirectory(name)) {
      // This emulates writing `!v16/**`, `!v0.2/**`, etc. in the files array,
      // without trusting the user to have written the right thing.
      if (olderVersionDirectories.includes(name)) {
        continue;
      }
    }
    addFiles(rootDir, "", name);
  }

  return files;
}
