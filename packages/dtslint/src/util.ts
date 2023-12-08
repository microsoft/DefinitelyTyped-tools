import fs from "fs";
import { basename, dirname, join } from "path";
import stripJsonComments = require("strip-json-comments");
import * as ts from "typescript";

export function packageNameFromPath(path: string): string {
  const base = basename(path);
  return /^v\d+(\.\d+)?$/.exec(base) || /^ts\d\.\d/.exec(base) ? basename(dirname(path)) : base;
}
export function readJson(path: string) {
  const text = fs.readFileSync(path, "utf-8");
  return JSON.parse(stripJsonComments(text));
}

export function failure(ruleName: string, s: string): string {
  return `${s} See: https://github.com/microsoft/DefinitelyTyped-tools/blob/master/packages/dtslint/docs/${ruleName}.md`;
}

export function getCompilerOptions(dirPath: string): ts.CompilerOptions {
  const tsconfigPath = join(dirPath, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
  }
  return readJson(tsconfigPath).compilerOptions as ts.CompilerOptions;
}

export function isMainFile(fileName: string, allowNested: boolean) {
  // Linter may be run with cwd of the package. We want `index.d.ts` but not `submodule/index.d.ts` to match.
  if (fileName === "index.d.ts") {
    return true;
  }

  if (basename(fileName) !== "index.d.ts") {
    return false;
  }

  let parent = dirname(fileName);
  // May be a directory for an older version, e.g. `v0`.
  // Note a types redirect `foo/ts3.1` should not have its own header.
  if (allowNested && /^v(0\.)?\d+$/.test(basename(parent))) {
    parent = dirname(parent);
  }

  // Allow "types/foo/index.d.ts", not "types/foo/utils/index.d.ts"
  return basename(dirname(parent)) === "types";
}
