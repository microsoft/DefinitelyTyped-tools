import { isDeclarationPath, typesPackageNameToRealName } from "@definitelytyped/utils";
import { TSESLint, TSESTree, ESLintUtils } from "@typescript-eslint/utils";
import path from "path";
import fs from "fs";

// Possible TS bug can't figure out how to do declaration emit of created rules
// without an explicit type annotation here due to pnpm symlink stuff
export type RuleModule<TOptions extends readonly unknown[], TMessageIds extends string> = TSESLint.RuleModule<
  TMessageIds,
  TOptions
>;

export const createRule: <TOptions extends readonly unknown[], TMessageIds extends string>(
  opts: Readonly<ESLintUtils.RuleWithMetaAndName<TOptions, TMessageIds>>,
) => RuleModule<TOptions, TMessageIds> = ESLintUtils.RuleCreator(
  (name) => `https://github.com/microsoft/DefinitelyTyped-tools/tree/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

export function getTypesPackageForDeclarationFile(file: string) {
  if (!isDeclarationPath(file)) {
    return undefined;
  }
  return findTypesPackage(file)?.realName;
}

export function commentsMatching(
  sourceFile: Readonly<TSESLint.SourceCode>,
  regex: RegExp,
  f: (match: string, c: TSESTree.Comment) => void,
): void {
  for (const comment of sourceFile.ast.comments) {
    const m = comment.value.match(regex);
    if (m) f(m[1], comment);
  }
}

export function findUp<T extends {}>(p: string, fn: (p: string) => T | undefined): T | undefined {
  p = path.resolve(p);
  const root = path.parse(p).root;

  while (true) {
    const v = fn(p);
    if (v !== undefined) {
      return v;
    }
    if (p === root) {
      break;
    }
    p = path.dirname(p);
  }

  return undefined;
}

export interface TypesPackageInfo {
  dir: string;
  /** package.json with name="@types/foo__bar-baz" */
  packageJson: PackageJSON;
  /** real package name being typed, like "@foo/bar-baz" */
  realName: string;
}

export interface PackageJSON {
  name: string;
  version: string;
  owners: string[];
  dependencies?: Record<string, string | undefined>;
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
  return findUp(file, (p) => {
    const packageJsonPath = path.join(p, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return undefined;
    }

    const packageJsonContents = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContents);
    if (!isTypesPackage(packageJson)) {
      return undefined;
    }
    return {
      dir: p,
      packageJson,
      realName: typesPackageNameToRealName(packageJson.name),
    };
  });
}

export function getImportSource(
  node: TSESTree.ImportDeclaration | TSESTree.TSImportEqualsDeclaration,
): TSESTree.StringLiteral | undefined {
  if (node.type === "ImportDeclaration") {
    return node.source;
  }

  if (
    node.moduleReference.type === "TSExternalModuleReference" &&
    node.moduleReference.expression.type === "Literal" &&
    typeof node.moduleReference.expression.value === "string"
  ) {
    return node.moduleReference.expression;
  }

  return undefined;
}

export function isMainFile(fileName: string, allowNested: boolean) {
  // Linter may be run with cwd of the package. We want `index.d.ts` but not `submodule/index.d.ts` to match.
  if (fileName === "index.d.ts") {
    return true;
  }

  if (path.basename(fileName) !== "index.d.ts") {
    return false;
  }

  let parent = path.dirname(fileName);
  // May be a directory for an older version, e.g. `v0`.
  // Note a types redirect `foo/ts3.1` should not have its own header.
  if (allowNested && /^v(0\.)?\d+$/.test(path.basename(parent))) {
    parent = path.dirname(parent);
  }

  // Allow "types/foo/index.d.ts", not "types/foo/utils/index.d.ts"
  return path.basename(path.dirname(parent)) === "types";
}
