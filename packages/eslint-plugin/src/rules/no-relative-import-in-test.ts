import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import * as ts from "typescript";
import { createRule, getImportSource } from "../util";
import { isDeclarationPath } from "@definitelytyped/utils";

const rule = createRule({
  name: "no-relative-import-in-test",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids test (non-declaration) files to use relative imports.",
    },
    messages: {
      useGlobalImport:
        "Test file should not use a relative import. Use a global import as if this were a user of the package.",
    },
    schema: [],
  },
  create(context) {
    if (isDeclarationPath(context.filename)) {
      return {};
    }

    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    function lint(node: TSESTree.ImportDeclaration | TSESTree.TSImportEqualsDeclaration) {
      const source = getImportSource(node);
      if (!source) {
        return;
      }

      if (!source.value.startsWith(".")) {
        return;
      }

      const moduleSymbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(source));
      if (!moduleSymbol) {
        // TODO(jakebailey): generally speaking, this should be an error; you can't import a non-module.
        return;
      }

      if (!moduleSymbol.declarations) {
        return;
      }

      for (const declaration of moduleSymbol.declarations) {
        if (ts.isSourceFile(declaration) && declaration.isDeclarationFile) {
          context.report({
            messageId: "useGlobalImport",
            node: source,
          });
          return;
        }
      }
    }

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ImportDeclaration(node) {
        lint(node);
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TSImportEqualsDeclaration(node) {
        lint(node);
      },
    };
  },
});

export = rule;
