import { unmangleScopedPackage } from "@definitelytyped/utils";
import { TSESTree, ESLintUtils } from "@typescript-eslint/utils";
import { RuleWithMetaAndName } from "@typescript-eslint/utils/dist/eslint-utils";
import { RuleListener, RuleModule, SourceCode } from "@typescript-eslint/utils/dist/ts-eslint";

// Possible TS bug can't figure out how to do declaration emit of created rules
// without an explicit type annotation here due to pnpm symlink stuff
export const createRule: <TOptions extends readonly unknown[], TMessageIds extends string>(
  opts: Readonly<RuleWithMetaAndName<TOptions, TMessageIds, RuleListener>>
) => RuleModule<TMessageIds, TOptions> = ESLintUtils.RuleCreator(
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

export function commentsMatching(
  sourceFile: Readonly<SourceCode>,
  regex: RegExp,
  f: (match: string, c: TSESTree.Comment) => void
): void {
  for (const comment of sourceFile.ast.comments) {
    const m = comment.value.match(regex);
    if (m) f(m[1], comment);
  }
}
