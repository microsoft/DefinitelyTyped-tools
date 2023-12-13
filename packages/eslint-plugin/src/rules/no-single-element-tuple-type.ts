import { createRule } from "../util";
import { TSESTree } from "@typescript-eslint/utils";

const rule = createRule({
  name: "no-single-element-tuple-type",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids `[T]`, which should be `T[]`.",
    },
    messages: {
      singleElementTupleType: `Type [T] is a single-element tuple type. You probably meant T[].`,
    },
    schema: [],
  },
  create(context) {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "TSTupleType[elementTypes.length=1]"(node: TSESTree.TSTupleType) {
        context.report({
          messageId: "singleElementTupleType",
          node,
        });
      },
    };
  },
});

export = rule;
