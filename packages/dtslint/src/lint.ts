import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { typeScriptPath } from "@definitelytyped/utils";
import assert = require("assert");
import { pathExists } from "fs-extra";
import { dirname, join as joinPaths, normalize } from "path";
import { Configuration, Linter } from "tslint";
import { ESLint } from "eslint";
import * as TsType from "typescript";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { getProgram, Options as ExpectOptions } from "./rules/expectRule";
import { readJson, withoutPrefix } from "./util";

export async function lint(
  dirPath: string,
  minVersion: TsVersion,
  maxVersion: TsVersion,
  isLatest: boolean,
  expectOnly: boolean,
  tsLocal: string | undefined
): Promise<string | undefined> {
  const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
  // TODO: To remove tslint, replace this with a ts.createProgram (probably)
  const lintProgram = Linter.createProgram(tsconfigPath);

  for (const version of [maxVersion, minVersion]) {
    const errors = testDependencies(version, dirPath, lintProgram, tsLocal);
    if (errors) {
      return errors;
    }
  }

  const linter = new Linter({ fix: false, formatter: "stylish" }, lintProgram);
  const configPath = expectOnly ? joinPaths(__dirname, "..", "dtslint-expect-only.json") : getConfigPath(dirPath);
  // TODO: To port expect-rule, eslint's config will also need to include [minVersion, maxVersion]
  //   Also: expect-rule should be renamed to expect-type or check-type or something
  const config = await getLintConfig(configPath, tsconfigPath, minVersion, maxVersion, tsLocal);
  const esfiles = [];

  for (const file of lintProgram.getSourceFiles()) {
    if (lintProgram.isSourceFileDefaultLibrary(file)) {
      continue;
    }

    const { fileName, text } = file;
    if (!fileName.includes("node_modules")) {
      const err =
        testNoTsIgnore(text) ||
        testNoLintDisables("tslint:disable", text) ||
        testNoLintDisables("eslint-disable", text);
      if (err) {
        const { pos, message } = err;
        const place = file.getLineAndCharacterOfPosition(pos);
        return `At ${fileName}:${JSON.stringify(place)}: ${message}`;
      }
    }

    // External dependencies should have been handled by `testDependencies`;
    // typesVersions should be handled in a separate lint
    if (!isExternalDependency(file, dirPath, lintProgram) && (!isLatest || !isTypesVersionPath(fileName, dirPath))) {
      linter.lint(fileName, text, config);
      esfiles.push(fileName);
    }
  }
  const result = linter.getResult();
  const cwd = process.cwd();
  process.chdir(dirPath);
  const eslint = new ESLint({
    rulePaths: [joinPaths(__dirname, "./rules/")],
  });
  const formatter = await eslint.loadFormatter("stylish");
  const eresults = await eslint.lintFiles(esfiles);
  process.chdir(cwd);

  let output: string | undefined;
  if (result.failures.length) output = result.output;
  output = (output || "") + formatter.format(eresults);
  return output;
}

function testDependencies(
  version: TsVersion,
  dirPath: string,
  lintProgram: TsType.Program,
  tsLocal: string | undefined
): string | undefined {
  const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
  assert(version !== "local" || tsLocal);
  const ts: typeof TsType = require(typeScriptPath(version, tsLocal));
  const program = getProgram(tsconfigPath, ts, version, lintProgram);
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => !d.file || isExternalDependency(d.file, dirPath, program));
  if (!diagnostics.length) {
    return undefined;
  }

  const showDiags = ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => dirPath,
    getNewLine: () => "\n",
  });

  const message = `Errors in typescript@${version} for external dependencies:\n${showDiags}`;

  // Add an edge-case for someone needing to `npm install` in react when they first edit a DT module which depends on it - #226
  const cannotFindDepsDiags = diagnostics.find(
    (d) => d.code === 2307 && d.messageText.toString().includes("Cannot find module")
  );
  if (cannotFindDepsDiags && cannotFindDepsDiags.file) {
    const path = cannotFindDepsDiags.file.fileName;
    const typesFolder = dirname(path);

    return `
A module look-up failed, this often occurs when you need to run \`npm install\` on a dependent module before you can lint.

Before you debug, first try running:

   npm install --prefix ${typesFolder}

Then re-run. Full error logs are below.

${message}`;
  } else {
    return message;
  }
}

export function isExternalDependency(file: TsType.SourceFile, dirPath: string, program: TsType.Program): boolean {
  return !startsWithDirectory(file.fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
}

function normalizePath(file: string) {
  // replaces '\' with '/' and forces all DOS drive letters to be upper-case
  return normalize(file)
    .replace(/\\/g, "/")
    .replace(/^[a-z](?=:)/, (c) => c.toUpperCase());
}

function isTypesVersionPath(fileName: string, dirPath: string) {
  const normalFileName = normalizePath(fileName);
  const normalDirPath = normalizePath(dirPath);
  const subdirPath = withoutPrefix(normalFileName, normalDirPath);
  return subdirPath && /^\/ts\d+\.\d/.test(subdirPath);
}

function startsWithDirectory(filePath: string, dirPath: string): boolean {
  const normalFilePath = normalizePath(filePath);
  const normalDirPath = normalizePath(dirPath).replace(/\/$/, "");
  return normalFilePath.startsWith(normalDirPath + "/") || normalFilePath.startsWith(normalDirPath + "\\");
}

interface Err {
  pos: number;
  message: string;
}
function testNoTsIgnore(text: string): Err | undefined {
  const tsIgnore = "ts-ignore";
  const pos = text.indexOf(tsIgnore);
  return pos === -1 ? undefined : { pos, message: "'ts-ignore' is forbidden." };
}
function testNoLintDisables(disabler: "tslint:disable" | "eslint-disable", text: string): Err | undefined {
  let lastIndex = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pos = text.indexOf(disabler, lastIndex);
    if (pos === -1) {
      return undefined;
    }
    const end = pos + disabler.length;
    const nextChar = text.charAt(end);
    const nextChar2 = text.charAt(end + 1);
    if (
      nextChar !== "-" &&
      !(disabler === "tslint:disable" && nextChar === ":") &&
      !(disabler === "eslint-disable" && nextChar === " " && nextChar2 !== "*")
    ) {
      const message =
        `'${disabler}' is forbidden. ` +
        "Per-line and per-rule disabling is allowed, for example: " +
        "'tslint:disable:rulename', tslint:disable-line' and 'tslint:disable-next-line' are allowed.";
      return { pos, message };
    }
    lastIndex = end;
  }
}

export async function checkTslintJson(dirPath: string, dt: boolean): Promise<void> {
  const configPath = getConfigPath(dirPath);
  const shouldExtend = `@definitelytyped/dtslint/${dt ? "dt" : "dtslint"}.json`;
  const validateExtends = (extend: string | string[]) =>
    extend === shouldExtend || (!dt && Array.isArray(extend) && extend.some((val) => val === shouldExtend));

  if (!(await pathExists(configPath))) {
    if (dt) {
      throw new Error(
        `On DefinitelyTyped, must include \`tslint.json\` containing \`{ "extends": "${shouldExtend}" }\`.\n` +
          "This was inferred as a DefinitelyTyped package because it contains a `// Type definitions for` header."
      );
    }
    return;
  }

  const tslintJson = await readJson(configPath);
  if (!validateExtends(tslintJson.extends)) {
    throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
  }
}

function getConfigPath(dirPath: string): string {
  return joinPaths(dirPath, "tslint.json");
}

async function getLintConfig(
  expectedConfigPath: string,
  tsconfigPath: string,
  minVersion: TsVersion,
  maxVersion: TsVersion,
  tsLocal: string | undefined
): Promise<IConfigurationFile> {
  const configExists = await pathExists(expectedConfigPath);
  const configPath = configExists ? expectedConfigPath : joinPaths(__dirname, "..", "dtslint.json");
  // Second param to `findConfiguration` doesn't matter, since config path is provided.
  const config = Configuration.findConfiguration(configPath, "").results;
  if (!config) {
    throw new Error(`Could not load config at ${configPath}`);
  }

  const expectRule = config.rules.get("expect");
  if (!expectRule || expectRule.ruleSeverity !== "error") {
    throw new Error("'expect' rule should be enabled, else compile errors are ignored");
  }
  if (expectRule) {
    const versionsToTest = range(minVersion, maxVersion).map((versionName) => ({
      versionName,
      path: typeScriptPath(versionName, tsLocal),
    }));
    const expectOptions: ExpectOptions = { tsconfigPath, versionsToTest };
    expectRule.ruleArguments = [expectOptions];
  }
  return config;
}

function range(minVersion: TsVersion, maxVersion: TsVersion): readonly TsVersion[] {
  if (minVersion === "local") {
    assert(maxVersion === "local");
    return ["local"];
  }
  if (minVersion === TypeScriptVersion.latest) {
    assert(maxVersion === TypeScriptVersion.latest);
    return [TypeScriptVersion.latest];
  }
  assert(maxVersion !== "local");

  const minIdx = TypeScriptVersion.shipped.indexOf(minVersion);
  assert(minIdx >= 0);
  if (maxVersion === TypeScriptVersion.latest) {
    return [...TypeScriptVersion.shipped.slice(minIdx), TypeScriptVersion.latest];
  }
  const maxIdx = TypeScriptVersion.shipped.indexOf(maxVersion as TypeScriptVersion);
  assert(maxIdx >= minIdx);
  return TypeScriptVersion.shipped.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "local";
