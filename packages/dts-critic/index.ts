import yargs = require("yargs");
import headerParser = require("@definitelytyped/header-parser");
import fs = require("fs");
import cp = require("child_process");
import path = require("path");
import semver = require("semver");
import rimraf = require("rimraf");
import { sync as commandExistsSync } from "command-exists";
import ts from "typescript";
import * as tmp from "tmp";

export enum ErrorKind {
  /** Declaration is marked as npm in header and has no matching npm package. */
  NoMatchingNpmPackage = "NoMatchingNpmPackage",
  /** Declaration has no npm package matching specified version. */
  NoMatchingNpmVersion = "NoMatchingNpmVersion",
  /** Declaration is not for an npm package, but has a name that conflicts with an existing npm package. */
  NonNpmHasMatchingPackage = "NonNpmHasMatchingPackage",
  /** Declaration needs to use `export =` to match the JavaScript module's behavior. */
  NeedsExportEquals = "NeedsExportEquals",
  /** Declaration has a default export, but JavaScript module does not have a default export. */
  NoDefaultExport = "NoDefaultExport",
  /** JavaScript exports property not found in declaration exports. */
  JsPropertyNotInDts = "JsPropertyNotInDts",
  /** Declaration exports property not found in JavaScript exports. */
  DtsPropertyNotInJs = "DtsPropertyNotInJs",
  /** JavaScript module has signatures, but declaration module does not. */
  JsSignatureNotInDts = "JsSignatureNotInDts",
  /** Declaration module has signatures, but JavaScript module does not. */
  DtsSignatureNotInJs = "DtsSignatureNotInJs",
}

export enum Mode {
  /** Checks based only on the package name and on the declaration's DefinitelyTyped header. */
  NameOnly = "name-only",
  /** Checks based on the source JavaScript code, in addition to the checks performed in name-only mode. */
  Code = "code",
}

export function parseMode(mode: string): Mode | undefined {
  switch (mode) {
    case Mode.NameOnly:
      return Mode.NameOnly;
    case Mode.Code:
      return Mode.Code;
  }
  return undefined;
}

export type CheckOptions = NameOnlyOptions | CodeOptions;
export interface NameOnlyOptions {
  mode: Mode.NameOnly;
}
export interface CodeOptions {
  mode: Mode.Code;
  errors: Map<ExportErrorKind, boolean>;
}

export type ExportErrorKind = ExportError["kind"];

const defaultOpts: CheckOptions = { mode: Mode.NameOnly };

export function dtsCritic(
  dtsPath: string,
  sourcePath?: string,
  options: CheckOptions = defaultOpts,
  debug = false
): CriticError[] {
  if (!commandExistsSync("tar")) {
    throw new Error(
      "You need to have tar installed to run dts-critic, you can get it from https://www.gnu.org/software/tar"
    );
  }
  if (!commandExistsSync("npm")) {
    throw new Error(
      "You need to have npm installed to run dts-critic, you can get it from https://www.npmjs.com/get-npm"
    );
  }

  const dts = fs.readFileSync(dtsPath, "utf-8");
  const header = parseDtHeader(dts);

  const name = findDtsName(dtsPath);
  const npmInfo = getNpmInfo(name);

  if (isNonNpm(header)) {
    const errors: CriticError[] = [];
    const nonNpmError = checkNonNpm(name, npmInfo);
    if (nonNpmError) {
      errors.push(nonNpmError);
    }

    if (sourcePath) {
      if (options.mode === Mode.Code) {
        errors.push(...checkSource(name, dtsPath, sourcePath, options.errors, debug));
      }
    } else if (!module.parent) {
      console.log(`Warning: declaration provided is for a non-npm package.
If you want to check the declaration against the JavaScript source code, you must provide a path to the source file.`);
    }

    return errors;
  } else {
    const npmVersion = checkNpm(name, npmInfo, header);
    if (typeof npmVersion !== "string") {
      return [npmVersion];
    }

    if (options.mode === Mode.Code) {
      let sourceEntry;
      let packagePath;
      if (sourcePath) {
        sourceEntry = sourcePath;
      } else {
        const tempDirName = tmp.dirSync({ unsafeCleanup: true }).name;
        packagePath = downloadNpmPackage(name, npmVersion, tempDirName);
        sourceEntry = require.resolve(path.resolve(packagePath));
      }
      const errors = checkSource(name, dtsPath, sourceEntry, options.errors, debug);
      if (packagePath) {
        // Delete the source afterward to avoid running out of space
        rimraf.sync(packagePath);
      }
      return errors;
    }

    return [];
  }
}

function parseDtHeader(dts: string): headerParser.Header | undefined {
  try {
    return headerParser.parseHeaderOrFail(dts);
  } catch (e) {
    return undefined;
  }
}

function isNonNpm(header: headerParser.Header | undefined): boolean {
  return !!header && header.nonNpm;
}

export const defaultErrors: ExportErrorKind[] = [ErrorKind.NeedsExportEquals, ErrorKind.NoDefaultExport];

function main() {
  const argv = yargs
    .usage(
      "$0 --dts path-to-d.ts [--js path-to-source] [--mode mode] [--debug]\n\nIf source-folder is not provided, I will look for a matching package on npm."
    )
    .option("dts", {
      describe: "Path of declaration file to be critiqued.",
      type: "string",
    })
    .demandOption("dts", "Please provide a path to a d.ts file for me to critique.")
    .option("js", {
      describe: "Path of JavaScript file to be used as source.",
      type: "string",
    })
    .option("mode", {
      describe: "Mode defines what checks will be performed.",
      type: "string",
      default: Mode.NameOnly,
      choices: [Mode.NameOnly, Mode.Code],
    })
    .option("debug", {
      describe: "Turn debug logging on.",
      type: "boolean",
      default: false,
    })
    .help().argv;

  let opts;
  switch (argv.mode) {
    case Mode.NameOnly:
      opts = { mode: argv.mode };
      break;
    case Mode.Code:
      opts = { mode: argv.mode, errors: new Map() };
  }
  const errors = dtsCritic(argv.dts, argv.js, opts, argv.debug);
  if (errors.length === 0) {
    console.log("No errors!");
  } else {
    for (const error of errors) {
      console.log("Error: " + error.message);
    }
  }
}

const npmNotFound = "E404";

export function getNpmInfo(name: string): NpmInfo {
  const npmName = dtToNpmName(name);
  const infoResult = cp.spawnSync("npm", ["info", npmName, "--json", "--silent", "versions", "dist-tags"], {
    encoding: "utf8",
  });
  const info = JSON.parse(infoResult.stdout || infoResult.stderr);
  if (info.error !== undefined) {
    const error = info.error as { code?: string; summary?: string };
    if (error.code === npmNotFound) {
      return { isNpm: false };
    } else {
      throw new Error(`Command 'npm info' for package ${npmName} returned an error. Reason: ${error.summary}.`);
    }
  } else if (infoResult.status !== 0) {
    throw new Error(`Command 'npm info' failed for package ${npmName} with status ${infoResult.status}.`);
  }
  return {
    isNpm: true,
    versions: info.versions as string[],
    tags: info["dist-tags"] as { [tag: string]: string | undefined },
  };
}

/**
 * Checks DefinitelyTyped non-npm package.
 */
function checkNonNpm(name: string, npmInfo: NpmInfo): NonNpmError | undefined {
  if (npmInfo.isNpm && !isExistingSquatter(name)) {
    return {
      kind: ErrorKind.NonNpmHasMatchingPackage,
      message: `The non-npm package '${name}' conflicts with the existing npm package '${dtToNpmName(name)}'.
Try adding -browser to the end of the name to get

    ${name}-browser
`,
    };
  }
  return undefined;
}

/**
 * Checks DefinitelyTyped npm package.
 * If all checks are successful, returns the npm version that matches the header.
 */
function checkNpm(name: string, npmInfo: NpmInfo, header: headerParser.Header | undefined): NpmError | string {
  if (!npmInfo.isNpm) {
    return {
      kind: ErrorKind.NoMatchingNpmPackage,
      message: `Declaration file must have a matching npm package.
To resolve this error, either:
1. Change the name to match an npm package.
2. Add a Definitely Typed header with the first line


// Type definitions for non-npm package ${name}-browser

Add -browser to the end of your name to make sure it doesn't conflict with existing npm packages.`,
    };
  }
  const target = getHeaderVersion(header);
  const npmVersion = getMatchingVersion(target, npmInfo);
  if (!npmVersion) {
    const versions = npmInfo.versions;
    const verstring = versions.join(", ");
    const lateststring = versions[versions.length - 1];
    const headerstring = target || "NO HEADER VERSION FOUND";
    return {
      kind: ErrorKind.NoMatchingNpmVersion,
      message: `The types for '${name}' must match a version that exists on npm.
You should copy the major and minor version from the package on npm.

To resolve this error, change the version in the header, ${headerstring},
to match one on npm: ${verstring}.

For example, if you're trying to match the latest version, use ${lateststring}.`,
    };
  }
  return npmVersion;
}

function getHeaderVersion(header: headerParser.Header | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  if (header.libraryMajorVersion === 0 && header.libraryMinorVersion === 0) {
    return undefined;
  }
  return `${header.libraryMajorVersion}.${header.libraryMinorVersion}`;
}

/**
 * Finds an npm version that matches the target version specified, if it exists.
 * If the target version is undefined, returns the latest version.
 * The npm version returned might be a prerelease version.
 */
function getMatchingVersion(target: string | undefined, npmInfo: Npm): string | undefined {
  const versions = npmInfo.versions;
  if (target) {
    const matchingVersion = semver.maxSatisfying(versions, target, { includePrerelease: true });
    return matchingVersion || undefined;
  }
  if (npmInfo.tags.latest) {
    return npmInfo.tags.latest;
  }
  return versions[versions.length - 1];
}

/**
 * If dtsName is 'index' (as with DT) then look to the parent directory for the name.
 */
export function findDtsName(dtsPath: string) {
  const resolved = path.resolve(dtsPath);
  const baseName = path.basename(resolved, ".d.ts");
  if (baseName && baseName !== "index") {
    return baseName;
  }
  return path.basename(path.dirname(resolved));
}

/** Returns path of downloaded npm package. */
function downloadNpmPackage(name: string, version: string, outDir: string): string {
  const npmName = dtToNpmName(name);
  const fullName = `${npmName}@${version}`;
  const cpOpts = { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 } as const;
  const npmPack = cp.execFileSync("npm", ["pack", fullName, "--json", "--silent"], cpOpts).trim();
  // https://github.com/npm/cli/issues/3405
  const tarballName = (npmPack.endsWith(".tgz") ? npmPack : (JSON.parse(npmPack)[0].filename as string))
    .replace(/^@/, "")
    .replace(/\//, "-");
  const outPath = path.join(outDir, name);
  initDir(outPath);
  const isBsdTar = cp.execFileSync("tar", ["--version"], cpOpts).includes("bsdtar");
  const args = isBsdTar
    ? ["-xz", "-f", tarballName, "-C", outPath]
    : ["-xz", "-f", tarballName, "-C", outPath, "--warning=none"];
  cp.execFileSync("tar", args, cpOpts);
  fs.unlinkSync(tarballName);
  return path.join(outPath, getPackageDir(outPath));
}

function getPackageDir(outPath: string): string {
  const dirs = fs.readdirSync(outPath, { encoding: "utf8", withFileTypes: true });
  for (const dirent of dirs) {
    if (dirent.isDirectory()) {
      return dirent.name;
    }
  }
  return "package";
}

function initDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function checkSource(
  name: string,
  dtsPath: string,
  srcPath: string,
  enabledErrors: Map<ExportErrorKind, boolean>,
  debug: boolean
): ExportError[] {
  const diagnostics = checkExports(name, dtsPath, srcPath);
  if (debug) {
    console.log(formatDebug(name, diagnostics));
  }

  return diagnostics.errors.filter((err) => enabledErrors.get(err.kind) ?? defaultErrors.includes(err.kind));
}

function formatDebug(name: string, diagnostics: ExportsDiagnostics): string {
  const lines: string[] = [];
  lines.push(`\tDiagnostics for package ${name}.`);
  lines.push("\tInferred source module structure:");
  if (isSuccess(diagnostics.jsExportKind)) {
    lines.push(diagnostics.jsExportKind.result);
  } else {
    lines.push(`Could not infer type of JavaScript exports. Reason: ${diagnostics.jsExportKind.reason}`);
  }
  lines.push("\tInferred source export type:");
  if (isSuccess(diagnostics.jsExportType)) {
    lines.push(formatType(diagnostics.jsExportType.result));
  } else {
    lines.push(`Could not infer type of JavaScript exports. Reason: ${diagnostics.jsExportType.reason}`);
  }
  if (diagnostics.dtsExportKind) {
    lines.push("\tInferred declaration module structure:");
    if (isSuccess(diagnostics.dtsExportKind)) {
      lines.push(diagnostics.dtsExportKind.result);
    } else {
      lines.push(`Could not infer type of declaration exports. Reason: ${diagnostics.dtsExportKind.reason}`);
    }
  }
  if (diagnostics.dtsExportType) {
    lines.push("\tInferred declaration export type:");
    if (isSuccess(diagnostics.dtsExportType)) {
      lines.push(formatType(diagnostics.dtsExportType.result));
    } else {
      lines.push(`Could not infer type of declaration exports. Reason: ${diagnostics.dtsExportType.reason}`);
    }
  }
  return lines.join("\n");
}

function formatType(type: ts.Type): string {
  const lines: string[] = [];
  //@ts-ignore property `checker` of `ts.Type` is marked internal. The alternative is to have a TypeChecker parameter.
  const checker: ts.TypeChecker = type.checker;

  const properties = type.getProperties();
  if (properties.length > 0) {
    lines.push("Type's properties:");
    lines.push(...properties.map((p) => p.getName()));
  }

  const signatures = type.getConstructSignatures().concat(type.getCallSignatures());
  if (signatures.length > 0) {
    lines.push("Type's signatures:");
    lines.push(...signatures.map((s) => checker.signatureToString(s)));
  }
  lines.push(`Type string: ${checker.typeToString(type)}`);
  return lines.join("\n");
}

const exportEqualsLink = "https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require";

/**
 * Checks exports of a declaration file against its JavaScript source.
 */
function checkExports(name: string, dtsPath: string, sourcePath: string): ExportsDiagnostics {
  const tscOpts = {
    allowJs: true,
  };

  const jsProgram = ts.createProgram([sourcePath], tscOpts);
  const jsFileNode = jsProgram.getSourceFile(sourcePath);
  if (!jsFileNode) {
    throw new Error(`TS compiler could not find source file ${sourcePath}.`);
  }
  const jsChecker = jsProgram.getTypeChecker();

  const errors: ExportError[] = [];
  const sourceDiagnostics = inspectJs(jsFileNode, jsChecker, name);

  const dtsDiagnostics = inspectDts(dtsPath, name);

  if (
    isSuccess(sourceDiagnostics.exportEquals) &&
    sourceDiagnostics.exportEquals.result.judgement === ExportEqualsJudgement.Required &&
    isSuccess(dtsDiagnostics.exportKind) &&
    dtsDiagnostics.exportKind.result !== DtsExportKind.ExportEquals
  ) {
    const error = {
      kind: ErrorKind.NeedsExportEquals,
      message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The declaration should use 'export =' syntax because the JavaScript source uses 'module.exports =' syntax and ${sourceDiagnostics.exportEquals.result.reason}.

To learn more about 'export =' syntax, see ${exportEqualsLink}.`,
    } as const;
    errors.push(error);
  }

  const compatibility = exportTypesCompatibility(
    name,
    sourceDiagnostics.exportType,
    dtsDiagnostics.exportType,
    dtsDiagnostics.exportKind
  );

  if (isSuccess(compatibility)) {
    errors.push(...compatibility.result);
  }

  if (dtsDiagnostics.defaultExport && !sourceDiagnostics.exportsDefault) {
    errors.push({
      kind: ErrorKind.NoDefaultExport,
      position: dtsDiagnostics.defaultExport,
      message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The declaration specifies 'export default' but the JavaScript source does not mention 'default' anywhere.

The most common way to resolve this error is to use 'export =' syntax instead of 'export default'.
To learn more about 'export =' syntax, see ${exportEqualsLink}.`,
    });
  }

  return {
    jsExportKind: sourceDiagnostics.exportKind,
    jsExportType: sourceDiagnostics.exportType,
    dtsExportKind: dtsDiagnostics.exportKind,
    dtsExportType: dtsDiagnostics.exportType,
    errors,
  };
}

function inspectJs(sourceFile: ts.SourceFile, checker: ts.TypeChecker, packageName: string): JsExportsInfo {
  const exportKind = getJsExportKind(sourceFile);
  const exportType = getJSExportType(sourceFile, checker, exportKind);
  const exportsDefault = sourceExportsDefault(sourceFile, packageName);

  let exportEquals;
  if (isSuccess(exportType) && isSuccess(exportKind) && exportKind.result === JsExportKind.CommonJs) {
    exportEquals = moduleTypeNeedsExportEquals(exportType.result, checker);
  } else {
    exportEquals = mergeErrors(exportType, exportKind);
  }

  return { exportKind, exportType, exportEquals, exportsDefault };
}

function getJsExportKind(sourceFile: ts.SourceFile): InferenceResult<JsExportKind> {
  // @ts-ignore property `commonJsModuleIndicator` of `ts.SourceFile` is marked internal.
  if (sourceFile.commonJsModuleIndicator) {
    return inferenceSuccess(JsExportKind.CommonJs);
  }
  // @ts-ignore property `externalModuleIndicator` of `ts.SourceFile` is marked internal.
  if (sourceFile.externalModuleIndicator) {
    return inferenceSuccess(JsExportKind.ES6);
  }
  return inferenceError("Could not infer export kind of source file.");
}

function getJSExportType(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  exportKind: InferenceResult<JsExportKind>
): InferenceResult<ts.Type> {
  if (isSuccess(exportKind)) {
    switch (exportKind.result) {
      case JsExportKind.CommonJs: {
        checker.getSymbolAtLocation(sourceFile); // TODO: get symbol in a safer way?
        //@ts-ignore property `symbol` of `ts.Node` is marked internal.
        const fileSymbol: ts.Symbol | undefined = sourceFile.symbol;
        if (!fileSymbol) {
          return inferenceError(`TS compiler could not find symbol for file node '${sourceFile.fileName}'.`);
        }
        const exportType = checker.getTypeOfSymbolAtLocation(fileSymbol, sourceFile);
        return inferenceSuccess(exportType);
      }
      case JsExportKind.ES6: {
        const fileSymbol = checker.getSymbolAtLocation(sourceFile);
        if (!fileSymbol) {
          return inferenceError(`TS compiler could not find symbol for file node '${sourceFile.fileName}'.`);
        }
        const exportType = checker.getTypeOfSymbolAtLocation(fileSymbol, sourceFile);
        return inferenceSuccess(exportType);
      }
    }
  }
  return inferenceError(`Could not infer type of exports because exports kind is undefined.`);
}

/**
 * Decide if a JavaScript source module could have a default export.
 */
function sourceExportsDefault(sourceFile: ts.SourceFile, name: string): boolean {
  const src = sourceFile.getFullText(sourceFile);
  return (
    isRealExportDefault(name) ||
    src.indexOf("default") > -1 ||
    src.indexOf("__esModule") > -1 ||
    src.indexOf("react-side-effect") > -1 ||
    src.indexOf("@flow") > -1 ||
    src.indexOf("module.exports = require") > -1
  );
}

function moduleTypeNeedsExportEquals(type: ts.Type, checker: ts.TypeChecker): InferenceResult<ExportEqualsDiagnostics> {
  if (isBadType(type)) {
    return inferenceError(`Inferred type '${checker.typeToString(type)}' is not good enough to be analyzed.`);
  }

  const isObject = type.getFlags() & ts.TypeFlags.Object;
  // @ts-ignore property `isArrayLikeType` of `ts.TypeChecker` is marked internal.
  if (isObject && !hasSignatures(type) && !checker.isArrayLikeType(type)) {
    const judgement = ExportEqualsJudgement.NotRequired;
    const reason = "'module.exports' is an object which is neither a function, class, or array";
    return inferenceSuccess({ judgement, reason });
  }

  if (hasSignatures(type)) {
    const judgement = ExportEqualsJudgement.Required;
    const reason = "'module.exports' can be called or constructed";
    return inferenceSuccess({ judgement, reason });
  }

  const primitive = ts.TypeFlags.Boolean | ts.TypeFlags.String | ts.TypeFlags.Number;
  if (type.getFlags() & primitive) {
    const judgement = ExportEqualsJudgement.Required;
    const reason = `'module.exports' has primitive type ${checker.typeToString(type)}`;
    return inferenceSuccess({ judgement, reason });
  }

  // @ts-ignore property `isArrayLikeType` of `ts.TypeChecker` is marked internal.
  if (checker.isArrayLikeType(type)) {
    const judgement = ExportEqualsJudgement.Required;
    const reason = `'module.exports' has array-like type ${checker.typeToString(type)}`;
    return inferenceSuccess({ judgement, reason });
  }

  return inferenceError(`Could not analyze type '${checker.typeToString(type)}'.`);
}

function hasSignatures(type: ts.Type): boolean {
  return type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0;
}

function inspectDts(dtsPath: string, name: string): DtsExportDiagnostics {
  dtsPath = path.resolve(dtsPath);
  const program = createDtProgram(dtsPath);
  const sourceFile = program.getSourceFile(path.resolve(dtsPath));
  if (!sourceFile) {
    throw new Error(`TS compiler could not find source file '${dtsPath}'.`);
  }
  const checker = program.getTypeChecker();
  const symbolResult = getDtsModuleSymbol(sourceFile, checker, name);
  const exportKindResult = getDtsExportKind(sourceFile);
  const exportType = getDtsExportType(sourceFile, checker, symbolResult, exportKindResult);
  const defaultExport = getDtsDefaultExport(sourceFile, exportType);

  return { exportKind: exportKindResult, exportType, defaultExport };
}

function createDtProgram(dtsPath: string): ts.Program {
  const dtsDir = path.dirname(dtsPath);
  const configPath = path.join(dtsDir, "tsconfig.json");
  const { config } = ts.readConfigFile(configPath, (p) => fs.readFileSync(p, { encoding: "utf8" }));
  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, { encoding: "utf8" }),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(config, parseConfigHost, path.resolve(dtsDir));
  const host = ts.createCompilerHost(parsed.options, true);
  return ts.createProgram([path.resolve(dtsPath)], parsed.options, host);
}

function getDtsModuleSymbol(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  name: string
): InferenceResult<ts.Symbol> {
  if (matches(sourceFile, (node) => ts.isModuleDeclaration(node))) {
    const npmName = dtToNpmName(name);
    const moduleSymbol = checker.getAmbientModules().find((symbol) => symbol.getName() === `"${npmName}"`);
    if (moduleSymbol) {
      return inferenceSuccess(moduleSymbol);
    }
  }

  const fileSymbol = checker.getSymbolAtLocation(sourceFile);
  if (fileSymbol && fileSymbol.getFlags() & ts.SymbolFlags.ValueModule) {
    return inferenceSuccess(fileSymbol);
  }

  return inferenceError(`Could not find module symbol for source file node.`);
}

function getDtsExportKind(sourceFile: ts.SourceFile): InferenceResult<DtsExportKind> {
  if (matches(sourceFile, isExportEquals)) {
    return inferenceSuccess(DtsExportKind.ExportEquals);
  }
  if (matches(sourceFile, isExportConstruct)) {
    return inferenceSuccess(DtsExportKind.ES6Like);
  }
  return inferenceError("Could not infer export kind of declaration file.");
}

const exportEqualsSymbolName = "export=";

function getDtsExportType(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  symbolResult: InferenceResult<ts.Symbol>,
  exportKindResult: InferenceResult<DtsExportKind>
): InferenceResult<ts.Type> {
  if (isSuccess(symbolResult) && isSuccess(exportKindResult)) {
    const symbol = symbolResult.result;
    const exportKind = exportKindResult.result;
    switch (exportKind) {
      case DtsExportKind.ExportEquals: {
        const exportSymbol = symbol.exports!.get(exportEqualsSymbolName as ts.__String);
        if (!exportSymbol) {
          return inferenceError(`TS compiler could not find \`export=\` symbol.`);
        }
        const exportType = checker.getTypeOfSymbolAtLocation(exportSymbol, sourceFile);
        return inferenceSuccess(exportType);
      }
      case DtsExportKind.ES6Like: {
        const exportType = checker.getTypeOfSymbolAtLocation(symbol, sourceFile);
        return inferenceSuccess(exportType);
      }
    }
  }

  return mergeErrors(symbolResult, exportKindResult);
}

/**
 * Returns the position of the default export, if it exists.
 */
function getDtsDefaultExport(sourceFile: ts.SourceFile, moduleType: InferenceResult<ts.Type>): Position | undefined {
  if (isError(moduleType)) {
    const src = sourceFile.getFullText(sourceFile);
    const exportDefault = src.indexOf("export default");
    if (exportDefault > -1 && src.indexOf("export =") === -1 && !/declare module ['"]/.test(src)) {
      return {
        start: exportDefault,
        length: "export default".length,
      };
    }
    return undefined;
  }

  const exportDefault = moduleType.result.getProperty("default");
  if (exportDefault?.declarations) {
    return {
      start: exportDefault.declarations[0].getStart(),
      length: exportDefault.declarations[0].getWidth(),
    };
  }
  return undefined;
}

const ignoredProperties = ["__esModule", "prototype", "default", "F", "G", "S", "P", "B", "W", "U", "R"];

function ignoreProperty(property: ts.Symbol): boolean {
  const name = property.getName();
  return name.startsWith("_") || ignoredProperties.includes(name);
}

/*
 * Given the inferred type of the exports of both source and declaration, we make the following checks:
 *  1. If source type has call or construct signatures, then declaration type should also have call or construct signatures.
 *  2. If declaration type has call or construct signatures, then source type should also have call or construct signatures.
 *  3. If source type has a property named "foo", then declaration type should also have a property named "foo".
 *  4. If declaration type has a property named "foo", then source type should also have a property named "foo".
 * Checks (2) and (4) don't work well in practice and should not be used for linting/verification purposes, because
 * most of the times the error originates because the inferred type of the JavaScript source has missing information.
 * Those checks are useful for finding examples where JavaScript type inference could be improved.
 */
function exportTypesCompatibility(
  name: string,
  sourceType: InferenceResult<ts.Type>,
  dtsType: InferenceResult<ts.Type>,
  dtsExportKind: InferenceResult<DtsExportKind>
): InferenceResult<MissingExport[]> {
  if (isError(sourceType)) {
    return inferenceError("Could not get type of exports of source module.");
  }
  if (isError(dtsType)) {
    return inferenceError("Could not get type of exports of declaration module.");
  }
  if (isBadType(sourceType.result)) {
    return inferenceError("Could not infer meaningful type of exports of source module.");
  }
  if (isBadType(dtsType.result)) {
    return inferenceError("Could not infer meaningful type of exports of declaration module.");
  }

  const errors: MissingExport[] = [];
  if (hasSignatures(sourceType.result) && !hasSignatures(dtsType.result)) {
    if (isSuccess(dtsExportKind) && dtsExportKind.result === DtsExportKind.ExportEquals) {
      errors.push({
        kind: ErrorKind.JsSignatureNotInDts,
        message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.`,
      });
    } else {
      errors.push({
        kind: ErrorKind.JsSignatureNotInDts,
        message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.

The most common way to resolve this error is to use 'export =' syntax.
To learn more about 'export =' syntax, see ${exportEqualsLink}.`,
      });
    }
  }

  if (hasSignatures(dtsType.result) && !hasSignatures(sourceType.result)) {
    errors.push({
      kind: ErrorKind.DtsSignatureNotInJs,
      message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The declaration module can be called or constructed, but the JavaScript module cannot.`,
    });
  }

  const sourceProperties = sourceType.result.getProperties();
  const dtsProperties = dtsType.result.getProperties();
  for (const sourceProperty of sourceProperties) {
    // TODO: check `prototype` properties.
    if (ignoreProperty(sourceProperty)) continue;
    if (!dtsProperties.find((s) => s.getName() === sourceProperty.getName())) {
      errors.push({
        kind: ErrorKind.JsPropertyNotInDts,
        message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The JavaScript module exports a property named '${sourceProperty.getName()}', which is missing from the declaration module.`,
      });
    }
  }

  for (const dtsProperty of dtsProperties) {
    // TODO: check `prototype` properties.
    if (ignoreProperty(dtsProperty)) continue;
    if (!sourceProperties.find((s) => s.getName() === dtsProperty.getName())) {
      const error: MissingExport = {
        kind: ErrorKind.DtsPropertyNotInJs,
        message: `The declaration doesn't match the JavaScript module '${name}'. Reason:
The declaration module exports a property named '${dtsProperty.getName()}', which is missing from the JavaScript module.`,
      };
      const declaration =
        dtsProperty.declarations && dtsProperty.declarations.length > 0 ? dtsProperty.declarations[0] : undefined;
      if (declaration) {
        error.position = {
          start: declaration.getStart(),
          length: declaration.getWidth(),
        };
      }
      errors.push(error);
    }
  }

  return inferenceSuccess(errors);
}

function isBadType(type: ts.Type): boolean {
  return !!(type.getFlags() & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Undefined | ts.TypeFlags.Null));
}

function isExportEquals(node: ts.Node): boolean {
  return ts.isExportAssignment(node) && !!node.isExportEquals;
}

function isExportConstruct(node: ts.Node): boolean {
  return ts.isExportAssignment(node) || ts.isExportDeclaration(node) || hasExportModifier(node);
}

function hasExportModifier(node: ts.Node): boolean {
  if (node.modifiers) {
    return node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  }
  return false;
}

function matches(srcFile: ts.SourceFile, predicate: (n: ts.Node) => boolean): boolean {
  function matchesNode(node: ts.Node): boolean {
    if (predicate(node)) return true;
    const children = node.getChildren(srcFile);
    for (const child of children) {
      if (matchesNode(child)) return true;
    }
    return false;
  }
  return matchesNode(srcFile);
}

function isExistingSquatter(name: string) {
  return (
    name === "atom" ||
    name === "ember__string" ||
    name === "fancybox" ||
    name === "jsqrcode" ||
    name === "node" ||
    name === "geojson" ||
    name === "titanium"
  );
}

function isRealExportDefault(name: string) {
  return name.indexOf("react-native") > -1 || name === "ember-feature-flags" || name === "material-ui-datatables";
}

/**
 * Converts a package name from the name used in DT repository to the name used in npm.
 * @param baseName DT name of a package
 */
export function dtToNpmName(baseName: string) {
  if (/__/.test(baseName)) {
    return "@" + baseName.replace("__", "/");
  }
  return baseName;
}

/**
 * @param error case-insensitive name of the error
 */
export function parseExportErrorKind(error: string): ExportErrorKind | undefined {
  error = error.toLowerCase();
  switch (error) {
    case "needsexportequals":
      return ErrorKind.NeedsExportEquals;
    case "nodefaultexport":
      return ErrorKind.NoDefaultExport;
    case "jspropertynotindts":
      return ErrorKind.JsPropertyNotInDts;
    case "dtspropertynotinjs":
      return ErrorKind.DtsPropertyNotInJs;
    case "jssignaturenotindts":
      return ErrorKind.JsSignatureNotInDts;
    case "dtssignaturenotinjs":
      return ErrorKind.DtsSignatureNotInJs;
  }
  return undefined;
}

export interface CriticError {
  kind: ErrorKind;
  message: string;
  position?: Position;
}

interface NpmError extends CriticError {
  kind: ErrorKind.NoMatchingNpmPackage | ErrorKind.NoMatchingNpmVersion;
}

interface NonNpmError extends CriticError {
  kind: ErrorKind.NonNpmHasMatchingPackage;
}

interface ExportEqualsError extends CriticError {
  kind: ErrorKind.NeedsExportEquals;
}

interface DefaultExportError extends CriticError {
  kind: ErrorKind.NoDefaultExport;
  position: Position;
}

interface MissingExport extends CriticError {
  kind:
    | ErrorKind.JsPropertyNotInDts
    | ErrorKind.DtsPropertyNotInJs
    | ErrorKind.JsSignatureNotInDts
    | ErrorKind.DtsSignatureNotInJs;
}

interface Position {
  start: number;
  length: number;
}

interface ExportsDiagnostics {
  jsExportKind: InferenceResult<JsExportKind>;
  jsExportType: InferenceResult<ts.Type>;
  dtsExportKind: InferenceResult<DtsExportKind>;
  dtsExportType: InferenceResult<ts.Type>;
  errors: ExportError[];
}

type ExportError = ExportEqualsError | DefaultExportError | MissingExport;

interface JsExportsInfo {
  exportKind: InferenceResult<JsExportKind>;
  exportType: InferenceResult<ts.Type>;
  exportEquals: InferenceResult<ExportEqualsDiagnostics>;
  exportsDefault: boolean;
}

enum JsExportKind {
  CommonJs = "CommonJs",
  ES6 = "ES6",
}

interface ExportEqualsDiagnostics {
  judgement: ExportEqualsJudgement;
  reason: string;
}

enum ExportEqualsJudgement {
  Required = "Required",
  NotRequired = "Not required",
}

enum DtsExportKind {
  ExportEquals = "export =",
  ES6Like = "ES6-like",
}

interface DtsExportDiagnostics {
  exportKind: InferenceResult<DtsExportKind>;
  exportType: InferenceResult<ts.Type>;
  defaultExport?: Position;
}

type NpmInfo = NonNpm | Npm;

interface NonNpm {
  isNpm: false;
}

interface Npm {
  isNpm: true;
  versions: string[];
  tags: { [tag: string]: string | undefined };
}

type InferenceResult<T> = InferenceError | InferenceSuccess<T>;

enum InferenceResultKind {
  Error,
  Success,
}

interface InferenceError {
  kind: InferenceResultKind.Error;
  reason?: string;
}

interface InferenceSuccess<T> {
  kind: InferenceResultKind.Success;
  result: T;
}

function inferenceError(reason?: string): InferenceError {
  return { kind: InferenceResultKind.Error, reason };
}

function inferenceSuccess<T>(result: T): InferenceSuccess<T> {
  return { kind: InferenceResultKind.Success, result };
}

function isSuccess<T>(inference: InferenceResult<T>): inference is InferenceSuccess<T> {
  return inference.kind === InferenceResultKind.Success;
}

function isError<T>(inference: InferenceResult<T>): inference is InferenceError {
  return inference.kind === InferenceResultKind.Error;
}

function mergeErrors(...results: (InferenceResult<unknown> | string)[]): InferenceError {
  const reasons: string[] = [];
  for (const result of results) {
    if (typeof result === "string") {
      reasons.push(result);
    } else if (isError(result) && result.reason) {
      reasons.push(result.reason);
    }
  }
  return inferenceError(reasons.join(" "));
}

if (!module.parent) {
  main();
}
