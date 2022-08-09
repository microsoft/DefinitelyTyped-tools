import { createRule } from "../util";

const rule = createRule({
  name: "no-useless-files",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids files with no content.",
      recommended: "error",
    },
    messages: {
      noContent: "File has no content.",
    },
    schema: [],
  },
  create(context) {
    const {
      ast: { tokens },
    } = context.getSourceCode();
    if (tokens.length === 0) {
      context.report({
        messageId: "noContent",
        loc: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 0 },
        },
      });
    }
    return {};
  },
});

export = rule;
