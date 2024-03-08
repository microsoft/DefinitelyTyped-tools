import { createGitHubStringSetGetter, joinPaths } from "@definitelytyped/utils";
import fs from "fs";
import { basename, dirname } from "path";
import stripJsonComments = require("strip-json-comments");
import * as ts from "typescript";

export function packageNameFromPath(path: string): string {
  const base = basename(path);
  return /^v\d+(\.\d+)?$/.exec(base) || /^ts\d\.\d/.exec(base) ? basename(dirname(path)) : base;
}
export function packageDirectoryNameWithVersionFromPath(path: string): string {
  const base = basename(path);
  const version = /^v\d+(\.\d+)?$/.test(base) ? base : undefined;
  const packageName = packageNameFromPath(path);
  return version ? `${packageName}/${version}` : packageName;
}
export function readJson(path: string) {
  const text = fs.readFileSync(path, "utf-8");
  return JSON.parse(stripJsonComments(text));
}

export function getCompilerOptions(tsconfigPath: string): {
  compilerOptions: ts.CompilerOptions;
  files?: string[];
  includes?: string[];
  excludes?: string[];
} {
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`${tsconfigPath} does not exist`);
  }
  return readJson(tsconfigPath) as {
    compilerOptions: ts.CompilerOptions;
    files?: string[];
    includes?: string[];
    excludes?: string[];
  };
}

const root = joinPaths(__dirname, "..");

export const getExpectedNpmVersionFailures = createGitHubStringSetGetter(
  "packages/dtslint/expectedNpmVersionFailures.txt",
  joinPaths(root, "expectedNpmVersionFailures.txt"),
);
