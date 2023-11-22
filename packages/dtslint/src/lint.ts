import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { typeScriptPath, withoutStart } from "@definitelytyped/utils";
import assert = require("assert");
import fs from "fs";
import { join as joinPaths, normalize, dirname, resolve as resolvePath } from "path";
import { Configuration, Linter } from "tslint";
import { ESLint } from "eslint";
import * as TsType from "typescript";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { readJson } from "./util";

export async function lint(
  dirPath: string,
  minVersion: TsVersion,
  maxVersion: TsVersion,
  isLatest: boolean,
  expectOnly: boolean,
  tsLocal: string | undefined,
): Promise<string | undefined> {
  const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
  const estree = await import(require.resolve("@typescript-eslint/typescript-estree", { paths: [dirPath] }));
  process.env.TSESTREE_SINGLE_RUN = "true";
  // TODO: To remove tslint, replace this with a ts.createProgram (probably)
  const lintProgram = Linter.createProgram(tsconfigPath);

  for (const version of [maxVersion, minVersion]) {
    const errors = testDependencies(version, dirPath, lintProgram, tsLocal);
    if (errors) {
      return errors;
    }
  }

  const linter = new Linter({ fix: false, formatter: "stylish" }, lintProgram);
  const configPath = getConfigPath(dirPath);
  // TODO: To port expect-rule, eslint's config will also need to include [minVersion, maxVersion]
  //   Also: expect-rule should be renamed to expect-type or check-type or something
  const config = getLintConfig(configPath);
  const esfiles = [];

  for (const file of lintProgram.getSourceFiles()) {
    if (lintProgram.isSourceFileDefaultLibrary(file)) {
      continue;
    }

    const { fileName, text } = file;
    if (!fileName.includes("node_modules")) {
      const err = testNoLintDisables("tslint:disable", text) || testNoLintDisables("eslint-disable", text);
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
  let output = result.failures.length ? result.output : "";

  const versionsToTest = range(minVersion, maxVersion).map((versionName) => ({
    versionName,
    path: typeScriptPath(versionName, tsLocal),
  }));

  const cwd = process.cwd();
  process.chdir(dirPath);

  const options: ESLint.Options = {
    overrideConfig: {
      overrides: [
        {
          files: ["*.ts", "*.cts", "*.mts", "*.tsx"],
          rules: {
            "@definitelytyped/expect": ["error", { versionsToTest }],
          },
        },
      ],
    },
  };

  if (expectOnly) {
    // Disable the regular config, instead load only the plugins and use just the rule above.
    // TODO(jakebailey): share this with eslint-plugin
    options.useEslintrc = false;
    options.overrideConfig!.plugins = ["@definitelytyped", "@typescript-eslint", "jsdoc"];
    const override = options.overrideConfig!.overrides![0];
    override.parser = "@typescript-eslint/parser";
    override.parserOptions = {
      project: true,
      warnOnUnsupportedTypeScriptVersion: false,
    };
  }

  const eslint = new ESLint(options);
  const formatter = await eslint.loadFormatter("stylish");
  const eresults = await eslint.lintFiles(esfiles);
  output += formatter.format(eresults);
  estree.clearCaches();
  process.chdir(cwd);

  return output;
}

function testDependencies(
  version: TsVersion,
  dirPath: string,
  lintProgram: TsType.Program,
  tsLocal: string | undefined,
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
    (d) => d.code === 2307 && d.messageText.toString().includes("Cannot find module"),
  );
  if (cannotFindDepsDiags && cannotFindDepsDiags.file) {
    return `
A module look-up failed, this often occurs when you need to run \`pnpm install\` on a dependent module before you can lint.

Before you debug, first try running:

   pnpm install -w --filter '...{./types/${dirPath}}...'

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
  const subdirPath = withoutStart(normalFileName, normalDirPath);
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
function testNoLintDisables(disabler: "tslint:disable" | "eslint-disable", text: string): Err | undefined {
  let lastIndex = 0;
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

export function checkTslintJson(dirPath: string): void {
  const configPath = getConfigPath(dirPath);
  const shouldExtend = "@definitelytyped/dtslint/dt.json";
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing \`tslint.json\` that contains \`{ "extends": "${shouldExtend}" }\`.`);
  }
  if (readJson(configPath).extends !== shouldExtend) {
    throw new Error(`'tslint.json' must extend "${shouldExtend}"`);
  }
}

function getConfigPath(dirPath: string): string {
  return joinPaths(dirPath, "tslint.json");
}

function getLintConfig(expectedConfigPath: string): IConfigurationFile {
  const configExists = fs.existsSync(expectedConfigPath);
  const configPath = configExists ? expectedConfigPath : joinPaths(__dirname, "..", "dtslint.json");
  // Second param to `findConfiguration` doesn't matter, since config path is provided.
  const config = Configuration.findConfiguration(configPath, "").results;
  if (!config) {
    throw new Error(`Could not load config at ${configPath}`);
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

  const minIdx = TypeScriptVersion.supported.indexOf(minVersion);
  assert(minIdx >= 0);
  if (maxVersion === TypeScriptVersion.latest) {
    return [...TypeScriptVersion.supported.slice(minIdx), TypeScriptVersion.latest];
  }
  const maxIdx = TypeScriptVersion.supported.indexOf(maxVersion as TypeScriptVersion);
  assert(maxIdx >= minIdx);
  return TypeScriptVersion.supported.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "local";

// TODO(jakebailey): this is also copied into the eslint-plugin; find a way to share it or remove.
const programCache = new WeakMap<TsType.Program, Map<string, TsType.Program>>();
/** Maps a tslint Program to one created with the version specified in `options`. */
export function getProgram(
  configFile: string,
  ts: typeof TsType,
  versionName: string,
  lintProgram: TsType.Program,
): TsType.Program {
  let versionToProgram = programCache.get(lintProgram);
  if (versionToProgram === undefined) {
    versionToProgram = new Map<string, TsType.Program>();
    programCache.set(lintProgram, versionToProgram);
  }

  let newProgram = versionToProgram.get(versionName);
  if (newProgram === undefined) {
    newProgram = createProgram(configFile, ts);
    versionToProgram.set(versionName, newProgram);
  }
  return newProgram;
}

function createProgram(configFile: string, ts: typeof TsType): TsType.Program {
  const projectDirectory = dirname(configFile);
  const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
  const parseConfigHost: TsType.ParseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf8"),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(config, parseConfigHost, resolvePath(projectDirectory), {
    noEmit: true,
  });

  if (config.compilerOptions?.module === "node16" && parsed.options.module === undefined) {
    // TypeScript version is too old to handle the "node16" module option,
    // but we can run tests falling back to commonjs/node.
    parsed.options.module = ts.ModuleKind.CommonJS;
    parsed.options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  }

  const host = ts.createCompilerHost(parsed.options, true);
  return ts.createProgram(parsed.fileNames, parsed.options, host);
}
