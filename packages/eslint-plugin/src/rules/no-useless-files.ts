import { commentsMatching, createRule } from "../util";

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
      ast: { tokens, comments },
    } = context.getSourceCode();

    if (tokens.length === 0) {
      if (comments.length === 0) {
        reportNoContent();
      } else {
        const referenceRegExp = /^\/\s*<reference\s*(types|path)\s*=\s*["|'](.*)["|']/;
        let noReferenceFound = true;
        commentsMatching(context.getSourceCode(), referenceRegExp, () => {
          noReferenceFound = false;
        });

        if (noReferenceFound) {
          reportNoContent();
        }
      }
    }

    return {};

    function reportNoContent() {
      context.report({
        messageId: "noContent",
        loc: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 0 },
        },
      });
    }
  },
});

export = rule;
