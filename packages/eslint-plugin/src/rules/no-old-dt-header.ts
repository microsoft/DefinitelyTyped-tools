import { isDeclarationPath } from "@definitelytyped/utils";
import { createRule } from "../util";

const rule = createRule({
  name: "no-bad-reference",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: `Forbids <reference path="./vNN"/> in all files, <reference path="../etc"/> in declaration files, and all <reference path> in test files.`,
    },
    messages: {
      noOldDTHeader:
        "Specify package metadata in package.json. Do not use a header like `// Type definitions for foo 1.2`",
    },
    schema: [],
  },
  create(context) {
    const text = context.getSourceCode().text;
    if (
      isDeclarationPath(context.getFilename()) &&
      text.indexOf("// Type definitions for ") === 0 &&
      text.indexOf("// Definitions by: ") > 0
    ) {
      context.report({
        messageId: "noOldDTHeader",
        loc: {
          start: { column: 0, line: 1 },
          end: {
            column: "// Type definitions for ".length,
            line: 1,
          },
        },
      });
    }
    return {};
  },
});

export = rule;
