import { createRule } from "../util";

const rule = createRule({
  name: "no-const-enum",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbid `const enum`",
      recommended: "error",
    },
    messages: {
      constEnum: "Use of `const enum` is forbidden.",
    },
    schema: [],
  },
  create(context) {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "TSEnumDeclaration[const]"(node) {
        context.report({
          messageId: "constEnum",
          node,
        });
      },
    };
  },
});

export = rule;
