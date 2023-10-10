import { validatePackageJson } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import {
  FS,
  assertDefined,
  computeHash,
  createModuleResolutionHost,
  filter,
  flatMap,
  hasWindowsSlashes,
  join,
  mapDefined,
  sort,
  split,
  unique,
  withoutStart,
} from "@definitelytyped/utils";
import assert from "assert";
import path from "path";
import * as ts from "typescript";
import {
  DirectoryParsedTypingVersion,
  TypingsDataRaw,
  TypingsVersionsRaw,
  formatTypingVersion,
  getLicenseFromPackageJson,
  getMangledNameForScopedPackage,
} from "../packages";
import { allReferencedFiles, createSourceFile, getDeclaredGlobals } from "./module-info";
import { getAllowedPackageJsonDependencies } from "./settings";
import { slicePrefixes } from "./utils";

function matchesVersion(
  typingsDataRaw: TypingsDataRaw,
  version: DirectoryParsedTypingVersion,
  considerLibraryMinorVersion: boolean
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

export async function getTypingInfo(packageName: string, dt: FS): Promise<TypingsVersionsRaw | string[]> {
  const errors = [];
  if (packageName !== packageName.toLowerCase()) {
    errors.push(`Package name \`${packageName}\` should be strictly lowercase`);
  }
  interface OlderVersionDir {
    readonly directoryName: string;
    readonly version: DirectoryParsedTypingVersion;
  }

  const fs = dt.subDir("types").subDir(getMangledNameForScopedPackage(packageName));
  const [rootDirectoryLs, olderVersionDirectories] = split<string, OlderVersionDir>(
    fs.readdir(),
    (fileOrDirectoryName) => {
      const version = parseVersionFromDirectoryName(fileOrDirectoryName);
      return version === undefined ? undefined : { directoryName: fileOrDirectoryName, version };
    }
  );

  const moduleResolutionHost = createModuleResolutionHost(dt, dt.debugPath());
  const considerLibraryMinorVersion = olderVersionDirectories.some(({ version }) => version.minor !== undefined);
  const latestDataResult = await combineDataForAllTypesVersions(packageName, rootDirectoryLs, fs, moduleResolutionHost);
  if (Array.isArray(latestDataResult)) {
    return [...errors, ...latestDataResult];
  }
  const latestData: TypingsDataRaw = { libraryVersionDirectoryName: undefined, ...latestDataResult };

  const older = await Promise.all(
    olderVersionDirectories.map(async ({ directoryName, version: directoryVersion }) => {
      if (matchesVersion(latestData, directoryVersion, considerLibraryMinorVersion)) {
        const latest = `${latestData.header.libraryMajorVersion}.${latestData.header.libraryMinorVersion}`;
        errors.push(
          `The latest version of the '${packageName}' package is ${latest}, so the subdirectory '${directoryName}' is not allowed` +
            (`v${latest}` === directoryName
              ? "."
              : `; since it applies to any ${latestData.header.libraryMajorVersion}.* version, up to and including ${latest}.`)
        );
      }

      // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
      const ls = fs.readdir(directoryName);
      const result = await combineDataForAllTypesVersions(
        packageName,
        ls,
        fs.subDir(directoryName),
        moduleResolutionHost
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
              `but package.json indicates major.minor version ${data.header.libraryMajorVersion}.${data.header.libraryMinorVersion}`
          );
        } else {
          errors.push(
            `Directory ${directoryName} indicates major version ${directoryVersion.major}, but package.json indicates major version ` +
              data.header.libraryMajorVersion.toString()
          );
        }
      }
      return data;
    })
  );
  if (errors.length) {
    return errors;
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
  readonly hasPackageJson: boolean;
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
  return { remainingLs, typesVersions, hasPackageJson: withoutPackageJson.length !== ls.length };
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
  directoryName: string | undefined
): DirectoryParsedTypingVersion | undefined {
  const match = /^v(\d+)(\.(\d+))?$/.exec(directoryName!);
  if (match === null) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: match[3] !== undefined ? Number(match[3]) : undefined, // tslint:disable-line strict-type-predicates (false positive)
  };
}

async function combineDataForAllTypesVersions(
  typingsPackageName: string,
  ls: readonly string[],
  fs: FS,
  moduleResolutionHost: ts.ModuleResolutionHost
): Promise<Omit<TypingsDataRaw, "libraryVersionDirectoryName"> | string[]> {
  const errors = [];
  const typesVersionAndPackageJson = getTypesVersionsAndPackageJson(ls);
  if (Array.isArray(typesVersionAndPackageJson)) {
    errors.push(...typesVersionAndPackageJson);
  }
  const { remainingLs, typesVersions, hasPackageJson } = Array.isArray(typesVersionAndPackageJson)
    ? { remainingLs: [], typesVersions: [], hasPackageJson: false }
    : typesVersionAndPackageJson;
  const packageJson = hasPackageJson
    ? (fs.readJson(packageJsonName) as {
        readonly license?: unknown;
        readonly dependencies?: unknown;
        readonly devDependencies?: unknown;
        readonly imports?: unknown;
        readonly exports?: unknown;
        readonly type?: unknown;
      })
    : {};
  const dataForRoot = getTypingDataForSingleTypesVersion(
    undefined,
    typingsPackageName,
    remainingLs,
    fs,
    moduleResolutionHost
  );
  if (Array.isArray(dataForRoot)) {
    errors.push(...dataForRoot);
  }
  const dataForOtherTypesVersions = typesVersions.map((tsVersion) => {
    const subFs = fs.subDir(`ts${tsVersion}`);
    const data = getTypingDataForSingleTypesVersion(
      tsVersion,
      typingsPackageName,
      subFs.readdir(),
      subFs,
      moduleResolutionHost
    );
    if (Array.isArray(data)) {
      errors.push(...data);
    }
    return data;
  });
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
  errors.push(...checkPackageJsonDependencies(packageJson.devDependencies, packageJsonName, allowedDependencies));
  const imports = checkPackageJsonImports(packageJson.imports, packageJsonName);
  if (Array.isArray(imports)) {
    errors.push(...imports);
  }
  const exports = checkPackageJsonExportsAndAddPJsonEntry(packageJson.exports, packageJsonName);
  if (Array.isArray(exports)) {
    errors.push(...exports);
  }
  const license = getLicenseFromPackageJson(packageJson.license);
  if (errors.length) {
    return errors;
  }

  const allTypesVersions = [dataForRoot, ...dataForOtherTypesVersions] as TypingDataFromIndividualTypeScriptVersion[];
  const files = Array.from(
    flatMap(allTypesVersions, ({ typescriptVersion, declFiles }) =>
      declFiles.map((file) => (typescriptVersion === undefined ? file : `ts${typescriptVersion}/${file}`))
    )
  );

  // Note that only the first project is collected right now
  return {
    header: assertDefined(header),
    typesVersions,
    files,
    license,
    dependencies: packageJson.dependencies as Record<string, string>,
    devDependencies: packageJson.devDependencies as Record<string, string>,
    contentHash: hash(
      hasPackageJson ? [...files, packageJsonName] : files,
      mapDefined(allTypesVersions, (a) => a.tsconfigPathsForHash),
      fs
    ),
    globals: getAllUniqueValues<"globals", string>(allTypesVersions, "globals"),
    imports: imports as object | undefined,
    exports: exports as string | object | undefined,
    type: packageJsonType as "module" | undefined,
  };
}

function getAllUniqueValues<K extends string, T>(records: readonly Record<K, readonly T[]>[], key: K): readonly T[] {
  return unique(flatMap(records, (x) => x[key]));
}

interface TypingDataFromIndividualTypeScriptVersion {
  /** Undefined for root (which uses typeScriptVersion in package.json instead) */
  readonly typescriptVersion: TypeScriptVersion | undefined;
  readonly declFiles: readonly string[]; // TODO: Used to map file.d.ts to ts4.1/file.d.ts -- not sure why this is needed
  readonly tsconfigPathsForHash: string | undefined;
  readonly globals: readonly string[];
}

/**
 * @param typescriptVersion Set if this is in e.g. a `ts3.1` directory.
 * @param packageName Name of the outermost directory; e.g. for "node/v4" this is just "node".
 * @param ls All file/directory names in `directory`.
 * @param fs FS rooted at the directory for this particular TS version, e.g. `types/abs/ts3.1` or `types/abs` when typescriptVersion is undefined.
 */
function getTypingDataForSingleTypesVersion(
  typescriptVersion: TypeScriptVersion | undefined,
  packageName: string,
  ls: readonly string[],
  fs: FS,
  moduleResolutionHost: ts.ModuleResolutionHost
): TypingDataFromIndividualTypeScriptVersion | string[] {
  const errors = [];
  const tsconfig = fs.readJson("tsconfig.json") as TsConfig;
  const configHost: ts.ParseConfigHost = {
    ...moduleResolutionHost,
    readDirectory: (dir) => fs.readdir(dir),
    useCaseSensitiveFileNames: true,
  };

  const compilerOptions = ts.parseJsonConfigFileContent(
    tsconfig,
    configHost,
    path.resolve("/", fs.debugPath())
  ).options;
  errors.push(...checkFilesFromTsConfig(packageName, tsconfig, fs.debugPath()));
  const { types, tests } = allReferencedFiles(
    tsconfig.files ?? [],
    fs,
    packageName,
    moduleResolutionHost,
    compilerOptions
  );
  const usedFiles = new Set(
    [...types.keys(), ...tests, "tsconfig.json", "tslint.json"].map((f) =>
      slicePrefixes(f, "node_modules/@types/" + packageName + "/")
    )
  );
  const otherFiles = ls.includes(unusedFilesName)
    ? fs
        // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
        .readFile(unusedFilesName)
        .split(/\r?\n/g)
        .filter(Boolean)
    : [];
  if (ls.includes(unusedFilesName) && !otherFiles.length) {
    errors.push(`In ${packageName}: OTHER_FILES.txt is empty.`);
  }
  for (const file of otherFiles) {
    if (!isRelativePath(file)) {
      errors.push(`In ${packageName}: A path segment is empty or all dots ${file}`);
    }
  }
  // Note: findAllUnusedFiles also modifies usedFiles and otherFiles and errors
  const unusedFiles = findAllUnusedFiles(ls, usedFiles, otherFiles, errors, packageName, fs);
  if (unusedFiles.length) {
    errors.push(
      "\n\t* " +
        unusedFiles.map((unused) => `Unused file ${unused}`).join("\n\t* ") +
        `\n\t(used files: ${JSON.stringify(Array.from(usedFiles))})`
    );
  }
  for (const untestedTypeFile of filter(
    otherFiles,
    (name) => name.endsWith(".d.ts") || name.endsWith(".d.mts") || name.endsWith(".d.cts")
  )) {
    // add d.ts files from OTHER_FILES.txt in order get their dependencies
    // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
    types.set(
      untestedTypeFile,
      createSourceFile(untestedTypeFile, fs.readFile(untestedTypeFile), moduleResolutionHost, compilerOptions)
    );
  }

  if (errors.length) return errors;
  return {
    typescriptVersion,
    globals: getDeclaredGlobals(types),
    declFiles: sort(types.keys()),
    tsconfigPathsForHash: JSON.stringify(tsconfig.compilerOptions.paths),
  };
}

// TODO: Expand these checks too, adding name and version just like dtslint
// TODO: Maybe should be in header-parser now?
function checkPackageJsonExportsAndAddPJsonEntry(exports: unknown, path: string) {
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

function checkPackageJsonImports(imports: unknown, path: string): object | string[] | undefined {
  if (imports === undefined) return imports;
  if (typeof imports !== "object") {
    return [`Package imports at path ${path} should be an object or string.`];
  } else if (imports === null) {
    return [`Package imports at path ${path} should not be null.`];
  }
  return imports;
}

function checkPackageJsonType(type: unknown, path: string) {
  if (type === undefined) return type;
  if (type !== "module") {
    return [`Package type at path ${path} can only be 'module'.`];
  }
  return type;
}

function checkPackageJsonDependencies(
  dependencies: unknown,
  path: string,
  allowedDependencies: ReadonlySet<string>
): string[] {
  if (dependencies === undefined) {
    return [];
  }
  if (dependencies === null || typeof dependencies !== "object") {
    return [`${path} should contain "dependencies" or not exist.`];
  }

  const errors: string[] = [];
  for (const dependencyName of Object.keys(dependencies!)) {
    // `dependencies` cannot be null because of check above.
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
  return errors;
}

function checkFilesFromTsConfig(packageName: string, tsconfig: TsConfig, directoryPath: string): string[] {
  const errors = [];
  const tsconfigPath = `${directoryPath}/tsconfig.json`;
  if (tsconfig.include) {
    errors.push(`In tsconfig, don't use "include", must use "files"`);
  }

  const files = tsconfig.files;
  if (!files) {
    errors.push(`${tsconfigPath} needs to specify  "files"`);
    return errors;
  }
  for (const file of files) {
    if (file.startsWith("./")) {
      errors.push(`In ${tsconfigPath}: Unnecessary "./" at the start of ${file}`);
    }
    if (!isRelativePath(file)) {
      errors.push(`In ${tsconfigPath}: A path segment is empty or all dots ${file}`);
    }
    if (file.endsWith(".d.ts") && file !== "index.d.ts") {
      errors.push(`${packageName}: Only index.d.ts may be listed explicitly in tsconfig's "files" entry.
Other d.ts files must either be referenced through index.d.ts, tests, or added to OTHER_FILES.txt.`);
    }

    if (!file.endsWith(".d.ts") && !file.startsWith("test/")) {
      const expectedName = `${packageName}-tests.ts`;
      if (file !== expectedName && file !== `${expectedName}x`) {
        const message =
          file.endsWith(".ts") || file.endsWith(".tsx")
            ? `Expected file '${file}' to be named '${expectedName}' or to be inside a '${directoryPath}/test/' directory`
            : `Unexpected file extension for '${file}' -- expected '.ts' or '.tsx' (maybe this should not be in "files", but ` +
              "OTHER_FILES.txt)";
        errors.push(message);
      }
    }
  }
  return errors;
}

function isRelativePath(path: string) {
  return path.split(/\//).every((part) => part.length > 0 && !part.match(/^\.+$|[\\\n\r]/));
}

interface TsConfig {
  include?: readonly string[];
  files?: readonly string[];
  compilerOptions: ts.CompilerOptions;
}

function hash(files: readonly string[], tsconfigPathsForHash: readonly string[], fs: FS): string {
  const fileContents = files.map((f) => `${f}**${readFileAndThrowOnBOM(f, fs)}`);
  let allContent = fileContents.join("||");
  for (const path of tsconfigPathsForHash) {
    allContent += path;
  }
  return computeHash(allContent);
}

export function readFileAndThrowOnBOM(fileName: string, fs: FS): string {
  // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
  const text = fs.readFile(fileName);
  if (text.charCodeAt(0) === 0xfeff) {
    const commands = ["npm install -g strip-bom-cli", `strip-bom ${fileName} > fix`, `mv fix ${fileName}`];
    throw new Error(`File '${fileName}' has a BOM. Try using:\n${commands.join("\n")}`);
  }
  return text;
}

const unusedFilesName = "OTHER_FILES.txt";

/** Modifies usedFiles and otherFiles and errors */
function findAllUnusedFiles(
  ls: readonly string[],
  usedFiles: Set<string>,
  otherFiles: string[],
  errors: string[],
  packageName: string,
  fs: FS
): string[] {
  // Double-check that no windows "\\" broke in.
  for (const fileName of usedFiles) {
    if (hasWindowsSlashes(fileName)) {
      errors.push(`In ${packageName}: windows slash detected in ${fileName}`);
    }
  }
  return findAllUnusedRecur(new Set(ls), usedFiles, new Set(otherFiles), errors, fs);
}

function findAllUnusedRecur(
  ls: Iterable<string>,
  usedFiles: Set<string>,
  otherFiles: Set<string>,
  errors: string[],
  fs: FS
): string[] {
  const unused = [];
  for (const lsEntry of ls) {
    if (usedFiles.has(lsEntry)) {
      continue;
    }
    if (otherFiles.has(lsEntry)) {
      otherFiles.delete(lsEntry);
      continue;
    }

    if (fs.isDirectory(lsEntry)) {
      const subdir = fs.subDir(lsEntry);
      // We allow a "scripts" directory to be used for scripts.
      if (lsEntry === "node_modules" || lsEntry === "scripts") {
        continue;
      }

      const lssubdir = subdir.readdir();
      if (lssubdir.length === 0) {
        errors.push(`Empty directory ${subdir.debugPath()} (${join(usedFiles)})`);
      }

      function takeSubdirectoryOutOfSet(originalSet: Set<string>): Set<string> {
        const subdirSet = new Set<string>();
        for (const file of originalSet) {
          const sub = withoutStart(file, `${lsEntry}/`);
          if (sub !== undefined) {
            originalSet.delete(file);
            subdirSet.add(sub);
          }
        }
        return subdirSet;
      }
      findAllUnusedRecur(
        lssubdir,
        takeSubdirectoryOutOfSet(usedFiles),
        takeSubdirectoryOutOfSet(otherFiles),
        errors,
        subdir
      );
    } else {
      if (
        lsEntry.toLowerCase() !== "readme.md" &&
        lsEntry !== "NOTICE" &&
        lsEntry !== ".editorconfig" &&
        lsEntry !== ".eslintrc.json" &&
        lsEntry !== unusedFilesName
      ) {
        unused.push(`${fs.debugPath()}/${lsEntry}`);
      }
    }
  }
  for (const otherFile of otherFiles) {
    if (usedFiles.has(otherFile)) {
      errors.push(
        `File ${fs.debugPath()}${otherFile} listed in ${unusedFilesName} is already reachable from tsconfig.json.`
      );
    }
    errors.push(`File ${fs.debugPath()}/${otherFile} listed in ${unusedFilesName} does not exist.`);
  }
  return unused;
}
