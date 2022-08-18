import { createRule } from "../util";

const rule = createRule({
  name: "no-dead-reference",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Ensures that all `/// <reference>` comments go at the top of the file.",
      recommended: "error",
    },
    messages: {
      referenceAtTop: "`/// <reference>` directive must be at top of file to take effect.",
    },
    schema: [],
  },
  create(context) {
    const source = context.getSourceCode();
    if (source.ast.body.length) {
      // 'm' flag makes it multiline, so `^` matches the beginning of any line.
      // 'g' flag lets us set rgx.lastIndex
      const rgx = /^\s*(\/\/\/ <reference)/gm;

      // Start search at the first statement. (`/// <reference>` before that is OK.)
      rgx.lastIndex = source.ast.body[0].range?.[0] ?? 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const match = rgx.exec(source.text);
        if (match === null) {
          break;
        }

        const length = match[1].length;
        const start = match.index + match[0].length - length;
        context.report({
          messageId: "referenceAtTop",
          loc: source.getLocFromIndex(start),
        });
      }
    }
    return {};
  },
});

export = rule;
