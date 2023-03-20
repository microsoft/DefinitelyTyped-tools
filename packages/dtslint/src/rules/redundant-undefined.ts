import { createRule } from "../util";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { TSESTree } from "@typescript-eslint/types";

const rule = createRule({
  name: "redundant-undefined",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids optional parameters from including an explicit `undefined` in their type; requires it in optional properties.",
      recommended: "error",
    },
    messages: {
      redundantUndefined: `Parameter is optional, so no need to include \`undefined\` in the type.`,
    },
    schema: [],
  },
  create(context) {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TSUnionType(node) {
        const hasUndefinedType = node.types.some((t) => t.type === AST_NODE_TYPES.TSUndefinedKeyword);
        if (node.parent!.type === AST_NODE_TYPES.TSTypeAnnotation
          && isParameter(node.parent!.parent!)
          && node.parent.parent.optional
          && isFunctionLike(node.parent!.parent!.parent!)
          && hasUndefinedType) {
          context.report({
            messageId: "redundantUndefined",
            node,
          });
        }
      },
    };
  },
});

function isFunctionLike(node: TSESTree.Node): node is TSESTree.FunctionLike {
  return node.type === AST_NODE_TYPES.ArrowFunctionExpression
    || node.type === AST_NODE_TYPES.FunctionDeclaration
    || node.type === AST_NODE_TYPES.FunctionExpression
    || node.type === AST_NODE_TYPES.TSDeclareFunction
    || node.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression;
}
/** Note: Does not include parameter properties because those can't be optional */
function isParameter(node: TSESTree.Node): node is Exclude<TSESTree.Parameter, TSESTree.TSParameterProperty> {
  return node.type === AST_NODE_TYPES.ArrayPattern
    || node.type === AST_NODE_TYPES.AssignmentPattern
    || node.type === AST_NODE_TYPES.Identifier
    || node.type === AST_NODE_TYPES.ObjectPattern
    || node.type === AST_NODE_TYPES.RestElement;
}

export = rule;
