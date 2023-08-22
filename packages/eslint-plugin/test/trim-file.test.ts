import { ESLintUtils } from "@typescript-eslint/utils";
import * as trimFile from "../src/rules/trim-file";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("@definitelytyped/trim-file", trimFile, {
  invalid: [
    {
      code: `\n `,
      errors: [
        {
          column: 1,
          line: 1,
          messageId: "leadingBlankLine",
        },
      ],
    },
    {
      code: `0;\n\n`,
      errors: [
        {
          column: 1,
          line: 3,
          messageId: "trailingBlankLine",
        },
      ],
    },
    {
      code: `0;\r\n\r\n`,
      errors: [
        {
          column: 1,
          line: 3,
          messageId: "trailingBlankLine",
        },
      ],
    },
  ],
  valid: [
    {
      code: `let foo = "I am right";\n`,
    },
  ],
});
