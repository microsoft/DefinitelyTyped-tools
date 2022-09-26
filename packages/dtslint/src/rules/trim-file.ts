import { createRule } from "../util";

const rule = createRule({
  defaultOptions: [],
  meta: {
    docs: {
      description: "Forbids leading/trailing blank lines in a file. Allows file to end in '\n'.",
      recommended: "error",
    },
    messages: {
      leading: "File should not begin with a blank line.",
      trailing: "File should not end with a blank line. (Ending in one newline OK, ending in two newlines not OK.)",
    },
    schema: [],
    type: "problem",
  },
  name: "trim-file",
  create(context) {
    const sourceCode = context.getSourceCode();
    const { lines, text } = sourceCode;
    if (text.startsWith("\r") || text.startsWith("\n")) {
      context.report({
        loc: {
          end: {
            column: lines[0].length,
            line: 1,
          },
          start: {
            column: 0,
            line: 1,
          },
        },
        messageId: "leading",
      });
    }

    if (text.endsWith("\n\n") || text.endsWith("\r\n\r\n")) {
      context.report({
        loc: {
          end: {
            column: lines[lines.length - 1].length,
            line: lines.length - 1,
          },
          start: {
            column: 0,
            line: lines.length - 1,
          },
        },
        messageId: "trailing",
      });
    }

    return {};
  },
});

export = rule;
