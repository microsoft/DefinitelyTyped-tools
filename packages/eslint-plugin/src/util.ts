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

export interface TypesPackageInfo {
  dir: string;
  packageJson: PackageJSON;
  realName: string;
}

export interface PackageJSON {
  name: string;
  version: string;
  owners: string[];
  devDependencies?: Record<string, string | undefined>;
}

// TODO(jakebailey): pull this helper out to util package?
function isTypesPackage(packageJson: Partial<PackageJSON>): boolean {
  return (
    typeof packageJson.name === "string" &&
    packageJson.name.startsWith("@types/") &&
    typeof packageJson.version === "string" &&
    Array.isArray(packageJson.owners)
  );
}

export function findTypesPackage(file: string): TypesPackageInfo | undefined {
  file = path.resolve(file);
  const root = path.parse(file).root;

  for (let dir = path.dirname(file); dir !== root; dir = path.dirname(dir)) {
    const packageJsonPath = path.join(dir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const packageJsonContents = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContents);
    if (isTypesPackage(packageJson)) {
      return {
        dir,
        packageJson,
        realName: typesPackageNameToRealName(packageJson.name),
      };
    }
  }

  return undefined;
}

export function findDtRoot(typesPackageDir: string) {
  // TODO(jakebailey): check package.json name instead? pnpm-workspace.yaml?
  let dir = typesPackageDir;
  const root = path.parse(dir).root;

  for (; dir !== root; dir = path.dirname(dir)) {
    if (path.basename(dir) === "types") {
      return path.dirname(dir);
    }
  }

  return undefined;
}
