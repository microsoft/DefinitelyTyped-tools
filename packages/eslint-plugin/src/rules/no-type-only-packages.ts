import { createRule, findTypesPackage, isMainFile } from "../util";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import path from "path";

const rule = createRule({
  name: "no-type-only-packages",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids type-only packages",
    },
    messages: {
      onlyTypes: "Packages should contain value components, not just types.",
    },
    schema: [],
  },
  create(context) {
    if (!isMainFile(context.filename, true)) {
      return {};
    }

    const pkg = findTypesPackage(context.filename);
    if (!pkg) {
      return {};
    }

    const program = ESLintUtils.getParserServices(context).program;

    let hasValueDeclaration = false;
    let hasNonEmptyFile = false;

    for (const sourceFile of program.getSourceFiles()) {
      if (
        !sourceFile.isDeclarationFile ||
        sourceFile.fileName.includes("node_modules") ||
        sourceFile.statements.length === 0 ||
        path.relative(pkg.dir, sourceFile.fileName).startsWith("..")
      ) {
        continue;
      }

      hasNonEmptyFile = true;

      function containsValueDeclaration(node: ts.Node): boolean {
        switch (node.kind) {
          case ts.SyntaxKind.VariableDeclaration:
          case ts.SyntaxKind.FunctionDeclaration:
          case ts.SyntaxKind.ClassDeclaration:
            return true;
        }

        return ts.forEachChild(node, containsValueDeclaration) ?? false;
      }

      if (containsValueDeclaration(sourceFile)) {
        hasValueDeclaration = true;
        break;
      }
    }

    if (hasNonEmptyFile && !hasValueDeclaration) {
      context.report({
        loc: { line: 1, column: 0 },
        messageId: "onlyTypes",
      });
    }

    return {};
  },
});

export = rule;
