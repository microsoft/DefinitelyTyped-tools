import { isDeclarationPath, typesPackageNameToRealName } from "@definitelytyped/utils";
import { TSESTree, ESLintUtils } from "@typescript-eslint/utils";
import { RuleWithMetaAndName } from "@typescript-eslint/utils/dist/eslint-utils";
import { RuleListener, RuleModule, SourceCode } from "@typescript-eslint/utils/dist/ts-eslint";
import path from "path";
import fs from "fs";

// Possible TS bug can't figure out how to do declaration emit of created rules
// without an explicit type annotation here due to pnpm symlink stuff
export const createRule: <TOptions extends readonly unknown[], TMessageIds extends string>(
  opts: Readonly<RuleWithMetaAndName<TOptions, TMessageIds, RuleListener>>
) => RuleModule<TMessageIds, TOptions> = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/microsoft/DefinitelyTyped-tools/tree/master/packages/eslint-plugin/docs/rules/${name}.md`
);

export function getTypesPackageForDeclarationFile(file: string) {
  if (!isDeclarationPath(file)) {
    return undefined;
  }
  const info = findTypesPackage(file);
  return info?.realName;
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

export function findTypesPackage(file: string) {
  file = path.resolve(file);
  let dir = path.dirname(file);
  const root = path.parse(dir).root;

  for (; dir !== root; dir = path.dirname(dir)) {
    try {
      const packageJsonContents = fs.readFileSync(path.join(dir, "package.json"), "utf8");
      const packageJson = JSON.parse(packageJsonContents) as {
        name?: string;
        version?: string;
        owners?: string[];
        devDependencies?: Record<string, string | undefined>;
      };
      // TODO(jakebailey): helper?
      if (packageJson.name?.startsWith("@types/") && packageJson.version && packageJson.owners) {
        return {
          dir,
          packageJson,
          realName: typesPackageNameToRealName(packageJson.name),
        };
      }
    } catch {
      // continue
    }
  }

  return undefined;
}

export function findDtRoot(typesPackageDir: string) {
  let dir = typesPackageDir;
  const root = path.parse(dir).root;

  for (; dir !== root; dir = path.dirname(dir)) {
    if (path.basename(dir) === "types") {
      return path.dirname(dir);
    }
  }

  return undefined;
}
