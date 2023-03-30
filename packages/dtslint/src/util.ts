import { ESLintUtils } from "@typescript-eslint/utils";
import assert = require("assert");
import { pathExistsSync, readFileSync } from "fs-extra";
import { basename, dirname, join } from "path";
import stripJsonComments = require("strip-json-comments");
import * as ts from "typescript";

export const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/microsoft/DefinitelyTyped-tools/tree/master/packages/dtslint/src/rules/${name}.ts`
);

export function packageNameFromPath(path: string): string {
  return /^v\d+(\.\d+)?$/.exec(path) || /^ts\d\.\d/.exec(path) ? basename(dirname(path)) : basename(path)
}
export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(stripJsonComments(readFileSync(path, "utf-8")));
}

export function failure(ruleName: string, s: string): string {
  return `${s} See: https://github.com/microsoft/DefinitelyTyped-tools/blob/master/packages/dtslint/docs/${ruleName}.md`;
}

export function getCommonDirectoryName(files: readonly string[]): string {
  let minLen = 999;
  let minDir = "";
  for (const file of files) {
    const dir = dirname(file);
    if (dir.length < minLen) {
      minDir = dir;
      minLen = dir.length;
    }
  }
  return basename(minDir);
}

export function getCompilerOptions(dirPath: string): ts.CompilerOptions {
  const tsconfigPath = join(dirPath, "tsconfig.json");
  if (!pathExistsSync(tsconfigPath)) {
    throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
  }
  return readJson(tsconfigPath).compilerOptions as ts.CompilerOptions;
}

export function withoutPrefix(s: string, prefix: string): string | undefined {
  return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}

export function last<T>(a: readonly T[]): T {
  assert(a.length !== 0);
  return a[a.length - 1];
}

export function assertDefined<T>(a: T | undefined): T {
  if (a === undefined) {
    throw new Error();
  }
  return a;
}

export async function mapDefinedAsync<T, U>(arr: Iterable<T>, mapper: (t: T) => Promise<U | undefined>): Promise<U[]> {
  const out = [];
  for (const a of arr) {
    const res = await mapper(a);
    if (res !== undefined) {
      out.push(res);
    }
  }
  return out;
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
