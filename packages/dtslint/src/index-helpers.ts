import { deepEquals } from "@definitelytyped/utils";
import fs from "fs";
import { basename, dirname, join as joinPaths } from "path";

/** @internal */
export function findDTRoot(dirPath: string) {
  let path = dirPath;
  while (basename(path) !== "types" && dirname(path) !== "." && dirname(path) !== "/" && dirname(path) !== path) {
    path = dirname(path);
  }
  return dirname(path);
}

/** @internal */
export function assertPathIsInDefinitelyTyped(dirPath: string, dtRoot: string): void {
  // TODO: It's not clear whether this assertion makes sense, and it's broken on Azure Pipelines (perhaps because DT isn't cloned into DefinitelyTyped)
  // Re-enable it later if it makes sense.
  // if (basename(dtRoot) !== "DefinitelyTyped")) {
  if (!fs.existsSync(joinPaths(dtRoot, "types"))) {
    throw new Error(
      "Since this type definition includes a header (a comment starting with `// Type definitions for`), " +
        "assumed this was a DefinitelyTyped package.\n" +
        "But it is not in a `DefinitelyTyped/types/xxx` directory: " +
        dirPath,
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
 * @internal
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

/** @internal */
export function combineErrorsAndWarnings(errors: string[], warnings: string[]): Error | string {
  const message = errors.concat(warnings).join("\n\n");
  return errors.length ? new Error(message) : message;
}

/** @internal */
export function checkExpectedFiles(dirPath: string, isLatest: boolean): { errors: string[] } {
  const errors = [];

  if (isLatest) {
    const expectedNpmIgnore = ["*", "!**/*.d.ts", "!**/*.d.cts", "!**/*.d.mts", "!**/*.d.*.ts"];

    if (basename(dirname(dirPath)) === "types") {
      for (const subdir of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (subdir.isDirectory() && /^v(\d+)(\.(\d+))?$/.test(subdir.name)) {
          expectedNpmIgnore.push(`/${subdir.name}/`);
        }
      }
    } else {
      const thisDir = `/${basename(dirPath)}/`;
      const parentNpmIgnorePath = joinPaths(dirname(dirPath), ".npmignore");
      if (!fs.existsSync(parentNpmIgnorePath)) {
        errors.push(`${dirPath}: Missing parent '.npmignore'`);
      } else {
        const parentNpmIgnore = tryReadFileSync(parentNpmIgnorePath)?.trim().split(/\r?\n/);
        if (!parentNpmIgnore || !parentNpmIgnore.includes(thisDir)) {
          errors.push(`${dirPath}: Parent package '.npmignore' should contain ${thisDir}`);
        }
      }
    }

    const expectedNpmIgnoreAsString = expectedNpmIgnore.join("\n");
    const npmIgnorePath = joinPaths(dirPath, ".npmignore");
    if (!fs.existsSync(npmIgnorePath)) {
      errors.push(`${dirPath}: Missing '.npmignore'; should contain:\n${expectedNpmIgnoreAsString}`);
    }

    const actualNpmIgnore = tryReadFileSync(npmIgnorePath)?.trim().split(/\r?\n/);
    if (!actualNpmIgnore || !deepEquals(actualNpmIgnore, expectedNpmIgnore)) {
      errors.push(`${dirPath}: Incorrect '.npmignore'; should be:\n${expectedNpmIgnoreAsString}`);
    }

    if (fs.existsSync(joinPaths(dirPath, "OTHER_FILES.txt"))) {
      errors.push(
        `${dirPath}: Should not contain 'OTHER_FILES.txt'. All files matching "**/*.d.{ts,cts,mts,*.ts}" are automatically included.`,
      );
    }
  }

  if (!fs.existsSync(joinPaths(dirPath, "index.d.ts"))) {
    errors.push(`${dirPath}: Must contain 'index.d.ts'.`);
  }

  if (fs.existsSync(joinPaths(dirPath, "tslint.json"))) {
    errors.push(
      `${dirPath}: Should not contain 'tslint.json'. This file is no longer required; place all lint-related options into .eslintrc.json.`,
    );
  }

  return { errors };
}

function tryReadFileSync(path: string): string | undefined {
  try {
    return fs.readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}
