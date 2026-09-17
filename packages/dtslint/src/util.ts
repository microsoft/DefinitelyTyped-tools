import { createGitHubStringSetGetter, joinPaths, readFile } from "@definitelytyped/utils";
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

export async function findDTRootAndPackageNameFrom(dirPath: string): Promise<{ dtRoot: string; packageName: string }> {
  const dtRoot = findDTRoot(dirPath);
  assertPathIsInDefinitelyTyped(dirPath, dtRoot);

  const packageName = packageNameFromPath(dirPath);
  assertPathIsNotBanned(packageName);

  const notNeededPackagesJsonPath = joinPaths(dtRoot, "notNeededPackages.json");
  const notNeededPackagesJson = await readFile(notNeededPackagesJsonPath);
  assertPackageIsNotDeprecated(packageName, notNeededPackagesJson);

  return { dtRoot, packageName };
}

export function findDTRoot(dirPath: string) {
  let path = dirPath;
  while (basename(path) !== "types" && dirname(path) !== "." && dirname(path) !== "/") {
    path = dirname(path);
  }
  return dirname(path);
}

export function assertPathIsInDefinitelyTyped(dirPath: string, dtRoot: string): void {
  // TODO: It's not clear whether this assertion makes sense, and it's broken on Azure Pipelines (perhaps because DT isn't cloned into DefinitelyTyped)
  // Re-enable it later if it makes sense.
  // if (basename(dtRoot) !== "DefinitelyTyped")) {
  if (!fs.existsSync(joinPaths(dtRoot, dirPath))) {
    throw new Error(
      [
        `The type definition for "${dirPath}" is expected to be a DefinitelyTyped package`,
        `located in \`DefinitelyTyped/${dirPath}\` directory`,
      ]
        .map((sentence) => sentence.trim())
        .join(" "),
    );
  }
}

/**
 * Starting at some point in time, npm has banned all new packages whose names
 * contain the word `download`. However, some older packages exist that still
 * contain this name.
 * @NOTE for contributors: The list of literal exceptions below should ONLY be
 * extended with packages for which there already exists a corresponding type
 * definition package in the `@types` scope. More information:
 * https://github.com/microsoft/DefinitelyTyped-tools/pull/381.
 */
export function assertPathIsNotBanned(packageName: string) {
  if (
    /(^|\W)download($|\W)/.test(packageName) &&
    packageName !== "download" &&
    packageName !== "downloadjs" &&
    packageName !== "s3-download-stream"
  ) {
    // Since npm won't release their banned-words list, we'll have to manually add to this list.
    throw new Error(`${packageName}: Contains the word 'download', which is banned by npm.`);
  }
}

export function assertPackageIsNotDeprecated(packageName: string, notNeededPackages: string) {
  const unneeded = JSON.parse(notNeededPackages).packages;
  if (Object.keys(unneeded).includes(packageName)) {
    throw new Error(
      [
        `${packageName}:`,
        `notNeededPackages.json has an entry for ${packageName}.`,

        `That means ${packageName} ships its own types,`,
        `and @types/${packageName} was deprecated and removed from Definitely Typed.`,

        `If you want to re-add @types/${packageName}, `,
        `please remove its entry from notNeededPackages.json.`,
      ]
        .map((sentence) => sentence.trim())
        .join(" "),
    );
  }
}
