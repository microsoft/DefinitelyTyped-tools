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
  tsLocal: string | undefined,
): Promise<string | undefined> {
  const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
  const estree = require(
    require.resolve("@typescript-eslint/typescript-estree", { paths: [dirPath] }),
  ) as typeof import("@typescript-eslint/typescript-estree");
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
  let output = "";

  const versionsToTest = range(minVersion, maxVersion).map((versionName) => ({
    versionName,
    path: typeScriptPath(versionName, tsLocal),
  }));

  const options: ESLint.Options = {
    cwd: dirPath,
    baseConfig: {
      overrides: [
        {
          files: ["*.ts", "*.cts", "*.mts", "*.tsx"],
          rules: {
            "@definitelytyped/npm-naming": "error",
          },
        },
      ],
    },
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
    options.baseConfig = undefined;
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
  const results = await eslint.lintFiles(files);
  output += formatter.format(results);
  estree.clearCaches();

  return output;
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
