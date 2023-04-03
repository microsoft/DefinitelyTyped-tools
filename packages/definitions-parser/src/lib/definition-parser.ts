import * as ts from "typescript";
import { parseHeaderOrFail } from "@definitelytyped/header-parser";
import { allReferencedFiles, createSourceFile, getDeclaredGlobals } from "./module-info";
import {
  DependencyVersion,
  formatTypingVersion,
  getLicenseFromPackageJson,
  TypingsDataRaw,
  TypingsVersionsRaw,
  DirectoryParsedTypingVersion,
  getMangledNameForScopedPackage,
} from "../packages";
import * as semver from "semver";
import { getAllowedPackageJsonDependencies } from "./settings";
import {
  FS,
  split,
  hasWindowsSlashes,
  mapDefined,
  filter,
  sort,
  withoutStart,
  computeHash,
  join,
  flatMap,
  unique,
  unmangleScopedPackage,
  createModuleResolutionHost,
} from "@definitelytyped/utils";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import path from "path";

function matchesVersion(
  typingsDataRaw: TypingsDataRaw,
  version: DirectoryParsedTypingVersion,
  considerLibraryMinorVersion: boolean
) {
  return (
    typingsDataRaw.libraryMajorVersion === version.major &&
    (considerLibraryMinorVersion
      ? version.minor === undefined || typingsDataRaw.libraryMinorVersion === version.minor
      : true)
  );
}

function formattedLibraryVersion(typingsDataRaw: TypingsDataRaw): `${number}.${number}` {
  return `${typingsDataRaw.libraryMajorVersion}.${typingsDataRaw.libraryMinorVersion}`;
}

export async function getTypingInfo(packageName: string, dt: FS): Promise<TypingsVersionsRaw> {
  if (packageName !== packageName.toLowerCase()) {
    throw new Error(`Package name \`${packageName}\` should be strictly lowercase`);
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

  const latestData: TypingsDataRaw = {
    libraryVersionDirectoryName: undefined,
    ...(await combineDataForAllTypesVersions(packageName, rootDirectoryLs, fs, undefined, moduleResolutionHost)),
  };

  const older = await Promise.all(
    olderVersionDirectories.map(async ({ directoryName, version: directoryVersion }) => {
      if (matchesVersion(latestData, directoryVersion, considerLibraryMinorVersion)) {
        const latest = `${latestData.libraryMajorVersion}.${latestData.libraryMinorVersion}`;
        throw new Error(
          `The latest version of the '${packageName}' package is ${latest}, so the subdirectory '${directoryName}' is not allowed` +
            (`v${latest}` === directoryName
              ? "."
              : `; since it applies to any ${latestData.libraryMajorVersion}.* version, up to and including ${latest}.`)
        );
      }

      // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
      const ls = fs.readdir(directoryName);
      const data: TypingsDataRaw = {
        libraryVersionDirectoryName: formatTypingVersion(directoryVersion),
        ...(await combineDataForAllTypesVersions(
          packageName,
          ls,
          fs.subDir(directoryName),
          directoryVersion,
          moduleResolutionHost
        )),
      };

      if (!matchesVersion(data, directoryVersion, considerLibraryMinorVersion)) {
        if (considerLibraryMinorVersion) {
          throw new Error(
            `Directory ${directoryName} indicates major.minor version ${directoryVersion.major}.${directoryVersion.minor}, ` +
              `but header indicates major.minor version ${data.libraryMajorVersion}.${data.libraryMinorVersion}`
          );
        }
        throw new Error(
          `Directory ${directoryName} indicates major version ${directoryVersion.major}, but header indicates major version ` +
            data.libraryMajorVersion.toString()
        );
      }
      return data;
    })
  );

  const res: TypingsVersionsRaw = {};
  res[formattedLibraryVersion(latestData)] = latestData;
  for (const o of older) {
    res[formattedLibraryVersion(o)] = o;
  }
  return res;
}

const packageJsonName = "package.json";

interface LsMinusTypesVersionsAndPackageJson {
  readonly remainingLs: readonly string[];
  readonly typesVersions: readonly TypeScriptVersion[];
  readonly hasPackageJson: boolean;
}
function getTypesVersionsAndPackageJson(ls: readonly string[]): LsMinusTypesVersionsAndPackageJson {
  const withoutPackageJson = ls.filter((name) => name !== packageJsonName);
  const [remainingLs, typesVersions] = split(withoutPackageJson, (fileOrDirectoryName) => {
    const match = /^ts(\d+\.\d+)$/.exec(fileOrDirectoryName);
    if (match === null) {
      return undefined;
    }

    const version = match[1];
    if (parseInt(version, 10) < 3) {
      throw new Error(
        `Directory name starting with 'ts' should be a TypeScript version newer than 3.0. Got: ${version}`
      );
    }
    return version as TypeScriptVersion;
  });
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

/**
 * Like `parseVersionFromDirectoryName`, but the leading 'v' is optional,
 * and falls back to '*' if the input format is not parseable.
 */
export function tryParsePackageVersion(versionString: string | undefined): DependencyVersion {
  const match = /^v?(\d+)(\.(\d+))?$/.exec(versionString!);
  if (match === null) {
    return "*";
  }
  return {
    major: Number(match[1]),
    minor: match[3] !== undefined ? Number(match[3]) : undefined, // tslint:disable-line strict-type-predicates (false positive)
  };
}

/**
 * Like `tryParsePackageVersion`, but throws if the input format is not parseable.
 */
export function parsePackageVersion(versionString: string): DirectoryParsedTypingVersion {
  const version = tryParsePackageVersion(versionString);
  if (version === "*") {
    throw new Error(`Version string '${versionString}' is not a valid format.`);
  }
  return version;
}

export function parsePackageSemver(version: string): DependencyVersion {
  const start = new semver.Range(version).set[0][0].semver
  if (start === (semver.Comparator as any).ANY) {
    return "*"
  }
  else {
    return { major: start.major, minor: start.minor }
  }
}

async function combineDataForAllTypesVersions(
  typingsPackageName: string,
  ls: readonly string[],
  fs: FS,
  directoryVersion: DirectoryParsedTypingVersion | undefined,
  moduleResolutionHost: ts.ModuleResolutionHost
): Promise<Omit<TypingsDataRaw, "libraryVersionDirectoryName">> {
  const { remainingLs, typesVersions, hasPackageJson } = getTypesVersionsAndPackageJson(ls);
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
  const packageJsonType = checkPackageJsonType(packageJson.type, packageJsonName);

  // Every typesVersion has an index.d.ts, but only the root index.d.ts should have a header.
  const {
    contributors,
    libraryMajorVersion,
    libraryMinorVersion,
    typeScriptVersion: minTsVersion,
    libraryName,
    projects,
  } = parseHeaderOrFail(readFileAndThrowOnBOM("index.d.ts", fs));

  const dataForRoot = getTypingDataForSingleTypesVersion(
    undefined,
    typingsPackageName,
    remainingLs,
    fs,
    directoryVersion,
    moduleResolutionHost
  );
  const dataForOtherTypesVersions = typesVersions.map((tsVersion) => {
    const subFs = fs.subDir(`ts${tsVersion}`);
    return getTypingDataForSingleTypesVersion(
      tsVersion,
      typingsPackageName,
      subFs.readdir(),
      subFs,
      directoryVersion,
      moduleResolutionHost
    );
  });
  const allTypesVersions = [dataForRoot, ...dataForOtherTypesVersions];
  const license = getLicenseFromPackageJson(packageJson.license);
  const allowedDependencies = await getAllowedPackageJsonDependencies()
  checkPackageJsonDependencies(packageJson.dependencies, packageJsonName, allowedDependencies);
  checkPackageJsonDependencies(packageJson.devDependencies, packageJsonName, allowedDependencies);

  const files = Array.from(
    flatMap(allTypesVersions, ({ typescriptVersion, declFiles }) =>
      declFiles.map((file) => (typescriptVersion === undefined ? file : `ts${typescriptVersion}/${file}`))
    )
  );

  // Note that only the first project is collected right now
  return {
    libraryName,
    typingsPackageName,
    projectName: projects[0],
    contributors,
    libraryMajorVersion,
    libraryMinorVersion,
    minTsVersion,
    typesVersions,
    files,
    license,
    packageJsonDependencies: packageJson.dependencies,
    packageJsonDevDependencies: packageJson.devDependencies,
    // TODO: Add devDependencies here (aka testDependencies)
    contentHash: hash(
      hasPackageJson ? [...files, packageJsonName] : files,
      mapDefined(allTypesVersions, (a) => a.tsconfigPathsForHash),
      fs
    ),
    globals: getAllUniqueValues<"globals", string>(allTypesVersions, "globals"),
    imports: checkPackageJsonImports(packageJson.imports, packageJsonName),
    exports: checkPackageJsonExportsAndAddPJsonEntry(packageJson.exports, packageJsonName),
    type: packageJsonType,
  };
}

function getAllUniqueValues<K extends string, T>(records: readonly Record<K, readonly T[]>[], key: K): readonly T[] {
  return unique(flatMap(records, (x) => x[key]));
}

interface TypingDataFromIndividualTypeScriptVersion {
  /** Undefined for root (which uses `// TypeScript Version: ` comment instead) */
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
  directoryVersion: DirectoryParsedTypingVersion | undefined,
  moduleResolutionHost: ts.ModuleResolutionHost
): TypingDataFromIndividualTypeScriptVersion {
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
  checkFilesFromTsConfig(packageName, tsconfig, fs.debugPath());

  const { types, tests, hasNonRelativeImports } = allReferencedFiles(
    tsconfig.files!,
    fs,
    packageName,
    moduleResolutionHost,
    compilerOptions
  );
  const usedFiles = new Set([...types.keys(), ...tests.keys(), "tsconfig.json", "tslint.json"].map(f => slicePrefix(f, "node_modules/@types/" + packageName + "/")));
  const otherFiles = ls.includes(unusedFilesName)
    ? fs
        // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
        .readFile(unusedFilesName)
        .split(/\r?\n/g)
        .filter(Boolean)
    : [];
  if (ls.includes(unusedFilesName) && !otherFiles.length) {
    throw new Error(`In ${packageName}: OTHER_FILES.txt is empty.`);
  }
  for (const file of otherFiles) {
    if (!isRelativePath(file)) {
      throw new Error(`In ${packageName}: A path segment is empty or all dots ${file}`);
    }
  }
  // Note: findAllUnusedFiles also modifies usedFiles and otherFiles
  const unusedFiles = findAllUnusedFiles(ls, usedFiles, otherFiles, packageName, fs);
  // TODO: Don't throw here, but instead return a list of errors to be printed by ???
  if (unusedFiles.length) {
    throw new Error('\n\t* ' + unusedFiles.map(unused => `Unused file ${unused}`).join("\n\t* ") + `\n\t(used files: ${JSON.stringify(Array.from(usedFiles))})`)
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

  const { paths } = tsconfig.compilerOptions;
  const hydratedPackageName = unmangleScopedPackage(packageName) ?? packageName;
  if (directoryVersion && hasNonRelativeImports && !(paths && `${hydratedPackageName}/*` in paths)) {
    const mapping = JSON.stringify([`${packageName}/v${formatTypingVersion(directoryVersion)}/*`]);
    throw new Error(
      `${hydratedPackageName}: Older version ${formatTypingVersion(
        directoryVersion
      )} must have a "paths" entry of "${hydratedPackageName}/*": ${mapping}`
    );
  }
  return {
    typescriptVersion,
    globals: getDeclaredGlobals(types),
    declFiles: sort(types.keys()),
    tsconfigPathsForHash: JSON.stringify(tsconfig.compilerOptions.paths),
  };
}

function slicePrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

// TODO: Expand these checks too, adding name and version just like dtslint
function checkPackageJsonExportsAndAddPJsonEntry(exports: unknown, path: string) {
  if (exports === undefined) return exports;
  if (typeof exports === "string") {
    return exports;
  }
  if (typeof exports !== "object") {
    throw new Error(`Package exports at path ${path} should be an object or string.`);
  }
  if (exports === null) {
    throw new Error(`Package exports at path ${path} should not be null.`);
  }
  if (!(exports as Record<string, unknown>)["./package.json"]) {
    (exports as Record<string, unknown>)["./package.json"] = "./package.json";
  }
  return exports;
}

function checkPackageJsonImports(imports: unknown, path: string) {
  if (imports === undefined) return imports;
  if (typeof imports !== "object") {
    throw new Error(`Package imports at path ${path} should be an object or string.`);
  }
  if (imports === null) {
    throw new Error(`Package imports at path ${path} should not be null.`);
  }
  return imports;
}

function checkPackageJsonType(type: unknown, path: string) {
  if (type === undefined) return type;
  if (type !== "module") {
    throw new Error(`Package type at path ${path} can only be 'module'.`);
  }
  return type;
}

function checkPackageJsonDependencies(
  dependencies: unknown,
  path: string,
  allowedDependencies: ReadonlySet<string>
): asserts dependencies is Record<string, string> {
  if (dependencies === undefined) {
    return;
  }
  if (dependencies === null || typeof dependencies !== "object") {
    throw new Error(`${path} should contain "dependencies" or not exist.`);
  }

  for (const dependencyName of Object.keys(dependencies!)) {
    // `dependencies` cannot be null because of check above.
    if (!dependencyName.startsWith("@types/") && !allowedDependencies.has(dependencyName)) {
      const msg = `Dependency ${dependencyName} not in the allowed dependencies list.
Please make a pull request to microsoft/DefinitelyTyped-tools adding it to \`packages/definitions-parser/allowedPackageJsonDependencies.txt\`.`;
      throw new Error(`In ${path}: ${msg}`);
    }
    const version = (dependencies as { [key: string]: unknown })[dependencyName];
    if (typeof version !== "string") {
      // tslint:disable-line strict-type-predicates
      throw new Error(`In ${path}: Dependency version for ${dependencyName} should be a string.`);
    }
  }
}

function checkFilesFromTsConfig(packageName: string, tsconfig: TsConfig, directoryPath: string): void {
  const tsconfigPath = `${directoryPath}/tsconfig.json`;
  if (tsconfig.include) {
    throw new Error(`In tsconfig, don't use "include", must use "files"`);
  }

  const files = tsconfig.files;
  if (!files) {
    throw new Error(`${tsconfigPath} needs to specify  "files"`);
  }
  for (const file of files) {
    if (file.startsWith("./")) {
      throw new Error(`In ${tsconfigPath}: Unnecessary "./" at the start of ${file}`);
    }
    if (!isRelativePath(file)) {
      throw new Error(`In ${tsconfigPath}: A path segment is empty or all dots ${file}`);
    }
    if (file.endsWith(".d.ts") && file !== "index.d.ts") {
      throw new Error(`${packageName}: Only index.d.ts may be listed explicitly in tsconfig's "files" entry.
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
        throw new Error(message);
      }
    }
  }
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

/** Modifies usedFiles and otherFiles */
function findAllUnusedFiles(
  ls: readonly string[],
  usedFiles: Set<string>,
  otherFiles: string[],
  packageName: string,
  fs: FS
): string[] {
  // Double-check that no windows "\\" broke in.
  for (const fileName of usedFiles) {
    if (hasWindowsSlashes(fileName)) {
      throw new Error(`In ${packageName}: windows slash detected in ${fileName}`);
    }
  }
  return findAllUnusedRecur(new Set(ls), usedFiles, new Set(otherFiles), fs);
}

function findAllUnusedRecur(ls: Iterable<string>, usedFiles: Set<string>, otherFiles: Set<string>, fs: FS): string[] {
  const unused = []
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
        // tslint:disable-next-line strict-string-expressions
        throw new Error(`Empty directory ${subdir.debugPath()} (${join(usedFiles)})`);
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
      findAllUnusedRecur(lssubdir, takeSubdirectoryOutOfSet(usedFiles), takeSubdirectoryOutOfSet(otherFiles), subdir);
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
      throw new Error(
        `File ${fs.debugPath()}${otherFile} listed in ${unusedFilesName} is already reachable from tsconfig.json.`
      );
    }
    throw new Error(`File ${fs.debugPath()}/${otherFile} listed in ${unusedFilesName} does not exist.`);
  }
  return unused
}
