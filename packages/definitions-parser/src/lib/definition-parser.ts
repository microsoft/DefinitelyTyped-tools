import * as ts from "typescript";
import { isTypeScriptVersion, parseHeaderOrFail } from "@definitelytyped/header-parser";
import { allReferencedFiles, createSourceFile, getModuleInfo, getTestDependencies } from "./module-info";
import {
  formatTypingVersion,
  getLicenseFromPackageJson,
  PackageId,
  PackageJsonDependency,
  PathMapping,
  TypingsDataRaw,
  TypingsVersionsRaw,
  TypingVersion
} from "../packages";
import { dependenciesWhitelist } from "./settings";
import {
  FS,
  split,
  mapDefined,
  filter,
  sort,
  withoutStart,
  computeHash,
  hasWindowsSlashes,
  join,
  flatMap,
  unique,
  unmangleScopedPackage,
  TypeScriptVersion
} from "@definitelytyped/utils";

function matchesVersion(typingsDataRaw: TypingsDataRaw, version: TypingVersion, considerLibraryMinorVersion: boolean) {
  return (
    typingsDataRaw.libraryMajorVersion === version.major &&
    (considerLibraryMinorVersion
      ? version.minor === undefined || typingsDataRaw.libraryMinorVersion === version.minor
      : true)
  );
}

function formattedLibraryVersion(typingsDataRaw: TypingsDataRaw) {
  return `${typingsDataRaw.libraryMajorVersion}.${typingsDataRaw.libraryMinorVersion}`;
}

/** @param fs Rooted at the package's directory, e.g. `DefinitelyTyped/types/abs` */
export function getTypingInfo(packageName: string, fs: FS): TypingsVersionsRaw {
  if (packageName !== packageName.toLowerCase()) {
    throw new Error(`Package name \`${packageName}\` should be strictly lowercase`);
  }
  interface OlderVersionDir {
    readonly directoryName: string;
    readonly version: TypingVersion;
  }
  const [rootDirectoryLs, olderVersionDirectories] = split<string, OlderVersionDir>(
    fs.readdir(),
    fileOrDirectoryName => {
      const version = parseVersionFromDirectoryName(fileOrDirectoryName);
      return version === undefined ? undefined : { directoryName: fileOrDirectoryName, version };
    }
  );

  const considerLibraryMinorVersion = olderVersionDirectories.some(({ version }) => version.minor !== undefined);

  const latestData: TypingsDataRaw = {
    libraryVersionDirectoryName: undefined,
    ...combineDataForAllTypesVersions(packageName, rootDirectoryLs, fs, undefined)
  };

  const older = olderVersionDirectories.map(({ directoryName, version: directoryVersion }) => {
    if (matchesVersion(latestData, directoryVersion, considerLibraryMinorVersion)) {
      const latest = `${latestData.libraryMajorVersion}.${latestData.libraryMinorVersion}`;
      throw new Error(
        `The latest version is ${latest}, so the subdirectory '${directoryName}' is not allowed` +
          (`v${latest}` === directoryName
            ? "."
            : `; since it applies to any ${latestData.libraryMajorVersion}.* version, up to and including ${latest}.`)
      );
    }

    const ls = fs.readdir(directoryName);
    const data: TypingsDataRaw = {
      libraryVersionDirectoryName: formatTypingVersion(directoryVersion),
      ...combineDataForAllTypesVersions(packageName, ls, fs.subDir(directoryName), directoryVersion)
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
  });

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
  const withoutPackageJson = ls.filter(name => name !== packageJsonName);
  const [remainingLs, typesVersions] = split(withoutPackageJson, fileOrDirectoryName => {
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
export function parseVersionFromDirectoryName(directoryName: string): TypingVersion | undefined {
  const match = /^v(\d+)(\.(\d+))?$/.exec(directoryName);
  if (match === null) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: match[3] !== undefined ? Number(match[3]) : undefined // tslint:disable-line strict-type-predicates (false positive)
  };
}

function combineDataForAllTypesVersions(
  typingsPackageName: string,
  ls: readonly string[],
  fs: FS,
  directoryVersion: TypingVersion | undefined
): Omit<TypingsDataRaw, "libraryVersionDirectoryName"> {
  const { remainingLs, typesVersions, hasPackageJson } = getTypesVersionsAndPackageJson(ls);

  // Every typesVersion has an index.d.ts, but only the root index.d.ts should have a header.
  const {
    contributors,
    libraryMajorVersion,
    libraryMinorVersion,
    typeScriptVersion: minTsVersion,
    libraryName,
    projects
  } = parseHeaderOrFail(readFileAndThrowOnBOM("index.d.ts", fs));

  const dataForRoot = getTypingDataForSingleTypesVersion(
    undefined,
    typingsPackageName,
    fs.debugPath(),
    remainingLs,
    fs,
    directoryVersion
  );
  const dataForOtherTypesVersions = typesVersions.map(tsVersion => {
    const subFs = fs.subDir(`ts${tsVersion}`);
    return getTypingDataForSingleTypesVersion(
      tsVersion,
      typingsPackageName,
      fs.debugPath(),
      subFs.readdir(),
      subFs,
      directoryVersion
    );
  });
  const allTypesVersions = [dataForRoot, ...dataForOtherTypesVersions];

  const packageJson = hasPackageJson
    ? (fs.readJson(packageJsonName) as { readonly license?: unknown; readonly dependencies?: unknown })
    : {};
  const license = getLicenseFromPackageJson(packageJson.license);
  const packageJsonDependencies = checkPackageJsonDependencies(packageJson.dependencies, packageJsonName);

  const files = Array.from(
    flatMap(allTypesVersions, ({ typescriptVersion, declFiles }) =>
      declFiles.map(file => (typescriptVersion === undefined ? file : `ts${typescriptVersion}/${file}`))
    )
  );

  return {
    libraryName,
    typingsPackageName,
    projectName: projects[0], // TODO: collect multiple project names
    contributors,
    libraryMajorVersion,
    libraryMinorVersion,
    minTsVersion,
    typesVersions,
    files,
    license,
    // TODO: Explicit type arguments shouldn't be necessary. https://github.com/Microsoft/TypeScript/issues/27507
    dependencies: getAllUniqueValues<"dependencies", PackageId>(allTypesVersions, "dependencies"),
    testDependencies: getAllUniqueValues<"testDependencies", string>(allTypesVersions, "testDependencies"),
    pathMappings: getAllUniqueValues<"pathMappings", PathMapping>(allTypesVersions, "pathMappings"),
    packageJsonDependencies,
    contentHash: hash(
      hasPackageJson ? [...files, packageJsonName] : files,
      mapDefined(allTypesVersions, a => a.tsconfigPathsForHash),
      fs
    ),
    globals: getAllUniqueValues<"globals", string>(allTypesVersions, "globals"),
    declaredModules: getAllUniqueValues<"declaredModules", string>(allTypesVersions, "declaredModules")
  };
}

function getAllUniqueValues<K extends string, T>(records: readonly Record<K, readonly T[]>[], key: K): readonly T[] {
  return unique(flatMap(records, x => x[key]));
}

interface TypingDataFromIndividualTypeScriptVersion {
  /** Undefined for root (which uses `// TypeScript Version: ` comment instead) */
  readonly typescriptVersion: TypeScriptVersion | undefined;
  readonly dependencies: readonly PackageId[];
  readonly testDependencies: readonly string[];
  readonly pathMappings: readonly PathMapping[];
  readonly declFiles: readonly string[];
  readonly tsconfigPathsForHash: string | undefined;
  readonly globals: readonly string[];
  readonly declaredModules: readonly string[];
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
  packageDirectory: string,
  ls: readonly string[],
  fs: FS,
  directoryVersion: TypingVersion | undefined
): TypingDataFromIndividualTypeScriptVersion {
  const tsconfig = fs.readJson("tsconfig.json") as TsConfig;
  checkFilesFromTsConfig(packageName, tsconfig, fs.debugPath());
  const { types, tests } = allReferencedFiles(tsconfig.files!, fs, packageName, packageDirectory);
  const usedFiles = new Set([...types.keys(), ...tests.keys(), "tsconfig.json", "tslint.json"]);
  const otherFiles =
    ls.indexOf(unusedFilesName) > -1
      ? fs
          .readFile(unusedFilesName)
          .split(/\r?\n/g)
          .filter(Boolean)
      : [];
  checkAllFilesUsed(ls, usedFiles, otherFiles, packageName, fs);
  for (const untestedTypeFile of filter(otherFiles, name => name.endsWith(".d.ts"))) {
    // add d.ts files from OTHER_FILES.txt in order get their dependencies
    types.set(untestedTypeFile, createSourceFile(untestedTypeFile, fs.readFile(untestedTypeFile)));
  }

  const { dependencies: dependenciesWithDeclaredModules, globals, declaredModules } = getModuleInfo(packageName, types);
  const declaredModulesSet = new Set(declaredModules);
  // Don't count an import of "x" as a dependency if we saw `declare module "x"` somewhere.
  const dependenciesSet = new Set(filter(dependenciesWithDeclaredModules, m => !declaredModulesSet.has(m)));
  const testDependencies = Array.from(
    filter(getTestDependencies(packageName, types, tests.keys(), dependenciesSet, fs), m => !declaredModulesSet.has(m))
  );

  const { dependencies, pathMappings } = calculateDependencies(
    packageName,
    tsconfig,
    dependenciesSet,
    directoryVersion
  );
  const tsconfigPathsForHash = JSON.stringify(tsconfig.compilerOptions.paths);
  return {
    typescriptVersion,
    dependencies,
    testDependencies,
    pathMappings,
    globals,
    declaredModules,
    declFiles: sort(types.keys()),
    tsconfigPathsForHash
  };
}

function checkPackageJsonDependencies(dependencies: unknown, path: string): readonly PackageJsonDependency[] {
  if (dependencies === undefined) {
    // tslint:disable-line strict-type-predicates (false positive)
    return [];
  }
  if (dependencies === null || typeof dependencies !== "object") {
    // tslint:disable-line strict-type-predicates
    throw new Error(`${path} should contain "dependencies" or not exist.`);
  }

  const deps: PackageJsonDependency[] = [];

  for (const dependencyName of Object.keys(dependencies!)) {
    // `dependencies` cannot be null because of check above.
    if (!dependenciesWhitelist.has(dependencyName)) {
      const msg = dependencyName.startsWith("@types/")
        ? `Dependency ${dependencyName} not in whitelist.
Don't use a 'package.json' for @types dependencies unless this package relies on
an old version of types that have since been moved to the source repo.
For example, if package *P* used to have types on Definitely Typed at @types/P,
but now has its own types, a dependent package *D* will need to use package.json
to refer to @types/P if it relies on old versions of P's types.
In this case, please make a pull request to types-publisher adding @types/P to \`dependenciesWhitelist.txt\`.`
        : `Dependency ${dependencyName} not in whitelist.
If you are depending on another \`@types\` package, do *not* add it to a \`package.json\`. Path mapping should make the import work.
For namespaced dependencies you then have to add a \`paths\` mapping from \`@namespace/library\` to \`namespace__library\` in \`tsconfig.json\`.
If this is an external library that provides typings,  please make a pull request to types-publisher adding it to \`dependenciesWhitelist.txt\`.`;
      throw new Error(`In ${path}: ${msg}`);
    }

    const version = (dependencies as { [key: string]: unknown })[dependencyName];
    if (typeof version !== "string") {
      // tslint:disable-line strict-type-predicates
      throw new Error(`In ${path}: Dependency version for ${dependencyName} should be a string.`);
    }
    deps.push({ name: dependencyName, version });
  }

  return deps;
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

interface TsConfig {
  include?: readonly string[];
  files?: readonly string[];
  compilerOptions: ts.CompilerOptions;
}

/** In addition to dependencies found in source code, also get dependencies from tsconfig. */
interface DependenciesAndPathMappings {
  readonly dependencies: readonly PackageId[];
  readonly pathMappings: readonly PathMapping[];
}
function calculateDependencies(
  packageName: string,
  tsconfig: TsConfig,
  dependencyNames: ReadonlySet<string>,
  directoryVersion: TypingVersion | undefined
): DependenciesAndPathMappings {
  const paths = (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) || {};

  const dependencies: PackageId[] = [];
  const pathMappings: PathMapping[] = [];

  for (const dependencyName of Object.keys(paths)) {
    // Might have a path mapping for "foo/*" to support subdirectories
    const rootDirectory = withoutEnd(dependencyName, "/*");
    if (rootDirectory !== undefined) {
      if (!(rootDirectory in paths)) {
        throw new Error(`In ${packageName}: found path mapping for ${dependencyName} but not for ${rootDirectory}`);
      }
      continue;
    }

    const pathMappingList = paths[dependencyName];
    if (pathMappingList.length !== 1) {
      throw new Error(`In ${packageName}: Path mapping for ${dependencyName} may only have 1 entry.`);
    }
    const pathMapping = pathMappingList[0];

    // Path mapping may be for "@foo/bar" -> "foo__bar".
    const scopedPackageName = unmangleScopedPackage(pathMapping);
    if (scopedPackageName !== undefined) {
      if (dependencyName !== scopedPackageName) {
        throw new Error(`Expected directory ${pathMapping} to be the path mapping for ${dependencyName}`);
      }
      continue;
    }

    const pathMappingVersion = parseDependencyVersionFromPath(dependencyName, dependencyName, pathMapping);
    if (dependencyName === packageName) {
      if (directoryVersion === undefined) {
        throw new Error(`In ${packageName}: Latest version of a package should not have a path mapping for itself.`);
      }
      if (directoryVersion.major !== pathMappingVersion.major || directoryVersion.minor !== pathMappingVersion.minor) {
        const correctPathMapping = [`${dependencyName}/v${formatTypingVersion(directoryVersion)}`];
        throw new Error(
          `In ${packageName}: Must have a "paths" entry of "${dependencyName}": ${JSON.stringify(correctPathMapping)}`
        );
      }
    } else {
      if (dependencyNames.has(dependencyName)) {
        dependencies.push({ name: dependencyName, version: pathMappingVersion });
      }
    }
    // Else, the path mapping may be necessary if it is for a transitive dependency. We will check this in check-parse-results.
    pathMappings.push({ packageName: dependencyName, version: pathMappingVersion });
  }

  if (directoryVersion !== undefined && !(paths && packageName in paths)) {
    const mapping = JSON.stringify([`${packageName}/v${formatTypingVersion(directoryVersion)}`]);
    throw new Error(
      `${packageName}: Older version ${formatTypingVersion(
        directoryVersion
      )} must have a "paths" entry of "${packageName}": ${mapping}`
    );
  }

  for (const dependency of dependencyNames) {
    if (!dependencies.some(d => d.name === dependency) && !nodeBuiltins.has(dependency)) {
      dependencies.push({ name: dependency, version: "*" });
    }
  }

  return { dependencies, pathMappings };
}

const nodeBuiltins: ReadonlySet<string> = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "zlib"
]);

function parseDependencyVersionFromPath(
  packageName: string,
  dependencyName: string,
  dependencyPath: string
): TypingVersion {
  const versionString = withoutStart(dependencyPath, `${dependencyName}/`);
  const version = versionString === undefined ? undefined : parseVersionFromDirectoryName(versionString);
  if (version === undefined) {
    throw new Error(`In ${packageName}, unexpected path mapping for ${dependencyName}: '${dependencyPath}'`);
  }
  return version;
}

function withoutEnd(s: string, end: string): string | undefined {
  if (s.endsWith(end)) {
    return s.slice(0, s.length - end.length);
  }
  return undefined;
}

function hash(files: readonly string[], tsconfigPathsForHash: readonly string[], fs: FS): string {
  const fileContents = files.map(f => `${f}**${readFileAndThrowOnBOM(f, fs)}`);
  let allContent = fileContents.join("||");
  for (const path of tsconfigPathsForHash) {
    allContent += path;
  }
  return computeHash(allContent);
}

export function readFileAndThrowOnBOM(fileName: string, fs: FS): string {
  const text = fs.readFile(fileName);
  if (text.charCodeAt(0) === 0xfeff) {
    const commands = ["npm install -g strip-bom-cli", `strip-bom ${fileName} > fix`, `mv fix ${fileName}`];
    throw new Error(`File '${fileName}' has a BOM. Try using:\n${commands.join("\n")}`);
  }
  return text;
}

const unusedFilesName = "OTHER_FILES.txt";

function checkAllFilesUsed(
  ls: readonly string[],
  usedFiles: Set<string>,
  otherFiles: string[],
  packageName: string,
  fs: FS
): void {
  // Double-check that no windows "\\" broke in.
  for (const fileName of usedFiles) {
    if (hasWindowsSlashes(fileName)) {
      throw new Error(`In ${packageName}: windows slash detected in ${fileName}`);
    }
  }
  checkAllUsedRecur(new Set(ls), usedFiles, new Set(otherFiles), fs);
}

function checkAllUsedRecur(ls: Iterable<string>, usedFiles: Set<string>, unusedFiles: Set<string>, fs: FS): void {
  for (const lsEntry of ls) {
    if (usedFiles.has(lsEntry)) {
      continue;
    }
    if (unusedFiles.has(lsEntry)) {
      unusedFiles.delete(lsEntry);
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
        throw new Error(`Empty directory ${subdir} (${join(usedFiles)})`);
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
      checkAllUsedRecur(lssubdir, takeSubdirectoryOutOfSet(usedFiles), takeSubdirectoryOutOfSet(unusedFiles), subdir);
    } else {
      if (
        lsEntry.toLowerCase() !== "readme.md" &&
        lsEntry !== "NOTICE" &&
        lsEntry !== ".editorconfig" &&
        lsEntry !== unusedFilesName
      ) {
        throw new Error(
          `Unused file ${fs.debugPath()}/${lsEntry} (used files: ${JSON.stringify(Array.from(usedFiles))})`
        );
      }
    }
  }

  for (const unusedFile of unusedFiles) {
    if (usedFiles.has(unusedFile)) {
      throw new Error(
        `File ${fs.debugPath()}/${unusedFile} listed in ${unusedFilesName} is already reachable from tsconfig.json.`
      );
    }
    throw new Error(`File ${fs.debugPath()}/${unusedFile} listed in ${unusedFilesName} does not exist.`);
  }
}
