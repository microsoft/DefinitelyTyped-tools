import { ESLintUtils } from "@typescript-eslint/utils";
import { basename, dirname } from "path";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/microsoft/DefinitelyTyped-tools/tree/master/packages/eslint-plugin/docs/rules/${name}.md`
);

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
