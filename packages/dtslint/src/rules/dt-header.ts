import { renderExpected, validate } from "@definitelytyped/header-parser";
import { createRule, isMainFile } from "../util";

type MessageId =
  | "definitionsBy"
  | "minimumTypeScriptVersion"
  | "parseError"
  | "typeDefinitionsFor"
  | "typescriptVersion";

const rule = createRule({
  name: "dt-header",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Ensure consistency of DefinitelyTyped headers.",
      recommended: "error",
    },
    messages: {
      definitionsBy: "Author name should be your name, not the default.",
      minimumTypeScriptVersion: "TypeScript version should be specified under header in `index.d.ts`.",
      parseError: "Error parsing header. Expected: {{expected}}",
      typeDefinitionsFor: "Header should only be in `index.d.ts` of the root.",
      typescriptVersion: "Minimum TypeScript version should be specified under header in `index.d.ts`.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    const { lines, text } = sourceCode;

    const lookFor = (search: string, messageId: MessageId) => {
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].startsWith(search)) {
          context.report({
            loc: {
              end: { line: i + 1, column: search.length },
              start: { line: i + 1, column: 0 },
            },
            messageId,
          });
        }
      }
    };

    if (!isMainFile(context.getFilename(), /*allowNested*/ true)) {
      lookFor("// Type definitions for", "typeDefinitionsFor");
      lookFor("// TypeScript Version", "typescriptVersion");
      lookFor("// Minimum TypeScript Version", "minimumTypeScriptVersion");
      return {};
    }

    lookFor("// Definitions by: My Self", "definitionsBy");

    const error = validate(text);
    if (error) {
      context.report({
        data: {
          expected: renderExpected(error.expected),
        },
        loc: {
          column: error.column,
          line: error.line,
        },
        messageId: "parseError",
      });
    }

    return {};
  },
});

export = rule;
