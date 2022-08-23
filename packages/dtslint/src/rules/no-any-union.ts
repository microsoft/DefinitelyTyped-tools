import { createRule } from "../util";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

const rule = createRule({
  name: "no-any-union",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbid a union to contain `any`",
      recommended: "error",
    },
    messages: {
      anyUnion: "Including `any` in a union will override all other members of the union.",
    },
    schema: [],
  },
  create(context) {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TSUnionType(node) {
        const hasAnyType = node.types.some((t) => t.type === AST_NODE_TYPES.TSAnyKeyword);
        if (hasAnyType) {
          context.report({
            messageId: "anyUnion",
            node,
          });
        }
      },
    };
  },
});

export = rule;
