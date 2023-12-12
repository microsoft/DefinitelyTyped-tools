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

    function isOutsidePackage(fileName: string): boolean {
      return fileName.includes("node_modules") || path.relative(pkg!.dir, fileName).startsWith("..");
    }

    for (const sourceFile of program.getSourceFiles()) {
      if (
        !sourceFile.isDeclarationFile ||
        sourceFile.statements.length === 0 ||
        isOutsidePackage(sourceFile.fileName)
      ) {
        continue;
      }

      hasNonEmptyFile = true;

      function isValueDeclaration(node: ts.Node): boolean {
        switch (node.kind) {
          case ts.SyntaxKind.VariableDeclaration:
          case ts.SyntaxKind.FunctionDeclaration:
          case ts.SyntaxKind.ClassDeclaration:
          case ts.SyntaxKind.EnumDeclaration:
            return true;
        }

        return false;
      }

      function symbolIsValue(node: ts.Node): boolean {
        const checker = program.getTypeChecker();
        const symbol = checker.getSymbolAtLocation(node);
        return symbol?.getDeclarations()?.some(isValueDeclaration) ?? false;
      }

      function symbolDefinedOutsidePackage(node: ts.Node): boolean {
        const checker = program.getTypeChecker();
        const symbol = checker.getSymbolAtLocation(node);
        return (
          symbol?.getDeclarations()?.some((declaration) => isOutsidePackage(declaration.getSourceFile().fileName)) ??
          false
        );
      }

      function containsValueDeclaration(node: ts.Node): boolean {
        if (isValueDeclaration(node)) {
          return true;
        }

        if (ts.isExportAssignment(node)) {
          return symbolIsValue(node.expression);
        }

        if (ts.isNamespaceExportDeclaration(node)) {
          return symbolIsValue(node.name);
        }

        if (ts.isNamedExports(node)) {
          return node.elements.some((element) => symbolIsValue(element.name));
        }

        if (ts.isInterfaceDeclaration(node)) {
          // If we're extending the interface of an external declaration, allow it.
          return symbolDefinedOutsidePackage(node.name);
        }

        if (ts.isModuleDeclaration(node) && !(ts.isIdentifier(node.name) && node.name.escapedText === "global")) {
          if (symbolDefinedOutsidePackage(node.name)) {
            // If we're extending a namespace in another package, allow it.
            return true;
          }
          // Otherwise, recurse and check for a value component.
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
