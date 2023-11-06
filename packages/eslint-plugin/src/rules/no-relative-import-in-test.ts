import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import { createRule } from "../util";
import { isDeclarationPath } from "@definitelytyped/utils";

const rule = createRule({
  name: "no-relative-import-in-test",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids test (non-declaration) files to use relative imports.",
      recommended: "error",
    },
    messages: {
      useGlobalImport:
        "Test file should not use a relative import. Use a global import as if this were a user of the package.",
    },
    schema: [],
  },
  create(context) {
    if (isDeclarationPath(context.getFilename())) {
      return {};
    }

    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ImportDeclaration(node) {
        const { source } = node;
        if (!source.value.startsWith(".")) {
          return;
        }

        const moduleSymbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(source));
        if (!moduleSymbol?.declarations) {
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
      },
    };
  },
});

export = rule;
