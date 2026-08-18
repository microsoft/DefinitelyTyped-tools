import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { withoutStart } from "@definitelytyped/utils";
import assert = require("assert");
import { join as joinPaths, normalize, resolve } from "path";
import { ESLint } from "eslint";
import * as TsType from "typescript";

import { createProgram } from "./createProgram";
import { lintTypeScript7Versions } from "./lintTypeScript7";
import { resolveLocalTypeScript, typeScriptPath } from "./typescript-installer";

export async function lint(
  dirPath: string,
  tsconfigs: readonly string[],
  minVersion: TsVersion,
  maxVersion: TsVersion,
  isLatest: boolean,
  expectOnly: boolean,
  tsLocal: string | undefined,
): Promise<string | undefined> {
  // If this package has been linked for local development,
  // we may end up with duplicate copies of typescript-estree.
  // Clear both so we are sure that we've cleared all caches.
  const estrees = [
    tryResolve("@typescript-eslint/typescript-estree"),
    tryResolve("@typescript-eslint/typescript-estree", { paths: [dirPath] }),
    tryResolve("@typescript-eslint/typescript-estree", { paths: [resolve(__dirname, "../../eslint-plugin")] }),
  ];
  process.env.TSESTREE_SINGLE_RUN = "true";

  const files = getSourceFiles(dirPath, isLatest);
  if (typeof files === "string") {
    return files;
  }

  const versions = range(minVersion, maxVersion);
  const legacyVersions: TsVersion[] = [];
  const typeScript7Versions: TsVersion[] = [];
  for (const version of versions) {
    (isTypeScript7(version, tsLocal) ? typeScript7Versions : legacyVersions).push(version);
  }

  const outputs: string[] = [];
  if (!expectOnly || legacyVersions.length) {
    const options = getEslintOptions(expectOnly, legacyVersions, tsLocal);
    const eslint = new ESLint(options);
    const formatter = await eslint.loadFormatter("stylish");
    const results = await eslint.lintFiles(files);
    const output = await formatter.format(results);
    if (output) {
      outputs.push(output);
    }
    for (const estreePath of estrees) {
      if (!estreePath) continue;
      const estree = require(estreePath) as typeof import("@typescript-eslint/typescript-estree");
      estree.clearCaches();
    }
  }

  if (typeScript7Versions.length) {
    const output = await lintTypeScript7Versions(dirPath, tsconfigs, typeScript7Versions, isLatest, tsLocal, files);
    if (output) {
      outputs.push(output);
    }
  }

  return outputs.join("\n") || undefined;
}

function getSourceFiles(dirPath: string, isLatest: boolean) {
  const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
  const lintProgram = createProgram(tsconfigPath);
  const files = [];

  for (const file of lintProgram.getSourceFiles()) {
    if (lintProgram.isSourceFileDefaultLibrary(file)) {
      continue;
    }

    const { fileName, text } = file;
    if (!fileName.includes("node_modules")) {
      const err = testNoLintDisables(text);
      if (err) {
        const { pos, message } = err;
        const place = file.getLineAndCharacterOfPosition(pos);
        return `At ${fileName}:${JSON.stringify(place)}: ${message}`;
      }
    }

    // External dependencies should have been handled by `testDependencies`;
    // typesVersions should be handled in a separate lint
    if (!isExternalDependency(file, dirPath, lintProgram) && (!isLatest || !isTypesVersionPath(fileName, dirPath))) {
      files.push(fileName);
    }
  }

  return files;
}

function tryResolve(path: string, options?: { paths?: string[] | undefined }): string | undefined {
  try {
    return require.resolve(path, options);
  } catch {
    return undefined;
  }
}

function getEslintOptions(
  expectOnly: boolean,
  versions: readonly TsVersion[],
  tsLocal: string | undefined,
): ESLint.Options {
  const versionsToTest = versions.map((versionName) => ({
    versionName,
    path: typeScriptPath(versionName, tsLocal),
  }));

  const allFiles = ["*.ts", "*.cts", "*.mts", "*.tsx"];

  const overrideConfig: ESLint.Options["overrideConfig"] = {
    settings: {
      dt: {
        versionsToTest,
      },
    },
    overrides: [
      {
        files: allFiles,
        rules: {
          // This prevents anyone from disabling this rule when it is responsible for ExpectType.
          "@definitelytyped/expect": versions.length ? ["error"] : "off",
        },
      },
    ],
  };

  if (expectOnly) {
    return {
      useEslintrc: false,
      overrideConfig: {
        plugins: ["@definitelytyped", "@typescript-eslint", "jsdoc"],
        parser: "@typescript-eslint/parser",
        parserOptions: {
          project: true,
          warnOnUnsupportedTypeScriptVersion: false,
        },
        ...overrideConfig,
      },
    };
  }

  return {
    overrideConfig,
  };
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
function testNoLintDisables(text: string): Err | undefined {
  const disabler = "eslint-disable";
  let lastIndex = 0;
  while (true) {
    const pos = text.indexOf(disabler, lastIndex);
    if (pos === -1) {
      return undefined;
    }
    const end = pos + disabler.length;
    const nextChar = text.charAt(end);
    const nextChar2 = text.charAt(end + 1);
    if (nextChar !== "-" && !(nextChar === " " && nextChar2 !== "*")) {
      const message =
        `'${disabler}' is forbidden. ` +
        "Per-line and per-rule disabling is allowed, for example: " +
        "'eslint-disable:rulename', eslint-disable-line' and 'eslint-disable-next-line' are allowed.";
      return { pos, message };
    }
    lastIndex = end;
  }
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
    return TypeScriptVersion.supported.slice(minIdx);
  }
  const maxIdx = TypeScriptVersion.supported.indexOf(maxVersion as TypeScriptVersion);
  assert(maxIdx >= minIdx);
  return TypeScriptVersion.supported.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "local";

function isTypeScript7(version: TsVersion, tsLocal: string | undefined): boolean {
  if (version !== "local") {
    return parseFloat(version) >= 7;
  }

  assert(tsLocal);
  return resolveLocalTypeScript(tsLocal).kind === "typescript7";
}
