import { unmangleScopedPackage } from "@definitelytyped/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import { RuleWithMetaAndName } from "@typescript-eslint/utils/dist/eslint-utils";
import { RuleListener, RuleModule } from "@typescript-eslint/utils/dist/ts-eslint";
import { basename, dirname } from "path";

// Possible TS bug can't figure out how to do declaration emit of created rules
// without an explicit type annotation here due to pnpm symlink stuff
export const createRule: <TOptions extends readonly unknown[], TMessageIds extends string>(opts: Readonly<RuleWithMetaAndName<TOptions, TMessageIds, RuleListener>>) => RuleModule<TMessageIds, TOptions> = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/microsoft/DefinitelyTyped-tools/tree/master/packages/eslint-plugin/docs/rules/${name}.md`
);

export function getTypesPackageForDeclarationFile(file: string) {
  if (!file.endsWith(".d.ts")) {
    return undefined;
  }

  const match = file.match(/types\/([^\/]+)\//)?.[1];
  if (!match) {
    return undefined;
  }

  return unmangleScopedPackage(match) ?? match;
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
