import { createRule } from "../util";

const rule = createRule({
  name: "trim-file",
  defaultOptions: [],
  meta: {
    type: "layout",
    docs: {
      description: "Forbids leading/trailing blank lines in a file. Allows file to end in '\n'",
      recommended: "error",
    },
    messages: {
      leadingBlankLine: "File should not begin with a blank line.",
      trailingBlankLine:
        "File should not end with a blank line. (Ending in one newline OK, ending in two newlines not OK.)",
    },
    schema: [],
  },
  create(context) {
    const { lines, text } = context.getSourceCode();
    if (text.startsWith("\r") || text.startsWith("\n")) {
      context.report({
        messageId: "leadingBlankLine",
        loc: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 0 },
        },
      });
    }
    if (text.endsWith("\n\n") || text.endsWith("\r\n\r\n")) {
      const line = lines.length;
      context.report({
        messageId: "trailingBlankLine",
        loc: {
          start: { line, column: 0 },
          end: { line, column: 0 },
        },
      });
    }

    return {};
  },
});

export = rule;
