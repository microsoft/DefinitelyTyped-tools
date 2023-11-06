import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

import { createRule } from "../util";
import { isDeclarationPath } from "@definitelytyped/utils";

const rule = createRule({
  defaultOptions: [],
  meta: {
    docs: {
      description: "Forbids `const x: () => void`.",
      recommended: "error",
    },
    messages: {
      variableFunction: "Use a function declaration instead of a variable of function type.",
    },
    schema: [],
    type: "problem",
  },
  name: "prefer-declare-function",
  create(context) {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "VariableDeclaration > VariableDeclarator"(node: TSESTree.VariableDeclarator) {
        if (
          node.id.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSFunctionType &&
          isDeclarationPath(context.getFilename())
        ) {
          context.report({
            messageId: "variableFunction",
            node: node.id,
          });
        }
      },
    };
  },
});

export = rule;
