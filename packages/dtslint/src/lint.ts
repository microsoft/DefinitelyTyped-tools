import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { typeScriptPath, withoutStart } from "@definitelytyped/utils";
import assert = require("assert");
import { join as joinPaths, normalize } from "path";
import { ESLint } from "eslint";
import * as TsType from "typescript";

import { createProgram } from "./createProgram";

export async function lint(
  dirPath: string,
  minVersion: TsVersion,
  maxVersion: TsVersion,
  isLatest: boolean,
  expectOnly: boolean,
  skipNpmNaming: boolean,
  tsLocal: string | undefined,
): Promise<string | undefined> {
  const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
  // If this package has been linked for local development,
  // we may end up with duplicate copies of typescript-estree.
  // Clear both so we are sure that we've cleared all caches.
  const estrees = [
    tryResolve("@typescript-eslint/typescript-estree"),
    tryResolve("@typescript-eslint/typescript-estree", { paths: [dirPath] }),
  ];
  process.env.TSESTREE_SINGLE_RUN = "true";
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
  const options = getEslintOptions(expectOnly, skipNpmNaming, minVersion, maxVersion, tsLocal);
  const eslint = new ESLint(options);
  const formatter = await eslint.loadFormatter("stylish");
  const results = await eslint.lintFiles(files);
  const output = formatter.format(results);
  for (const estreePath of estrees) {
    if (!estreePath) continue;
    const estree = require(estreePath) as typeof import("@typescript-eslint/typescript-estree");
    estree.clearCaches();
  }
  return output;
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
  skipNpmNaming: boolean,
  minVersion: TsVersion,
  maxVersion: TsVersion,
  tsLocal: string | undefined,
): ESLint.Options {
  const versionsToTest = range(minVersion, maxVersion).map((versionName) => ({
    versionName,
    path: typeScriptPath(versionName, tsLocal),
  }));

  const allFiles = ["*.ts", "*.cts", "*.mts", "*.tsx"];

  const overrideConfig: ESLint.Options["overrideConfig"] = {
    overrides: [
      {
        files: allFiles,
        rules: {
          "@definitelytyped/expect": ["error", { versionsToTest }],
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
    baseConfig: {
      overrides: [
        {
          files: allFiles,
          rules: skipNpmNaming
            ? {}
            : {
                "@definitelytyped/npm-naming": "error",
              },
        },
      ],
    },
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
    return [...TypeScriptVersion.supported.slice(minIdx), TypeScriptVersion.latest];
  }
  const maxIdx = TypeScriptVersion.supported.indexOf(maxVersion as TypeScriptVersion);
  assert(maxIdx >= minIdx);
  return TypeScriptVersion.supported.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "local";
