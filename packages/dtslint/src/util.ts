import assert = require("assert");
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

export function last<T>(a: readonly T[]): T {
  assert(a.length !== 0);
  return a[a.length - 1];
}
