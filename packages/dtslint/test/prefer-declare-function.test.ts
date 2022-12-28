import { ESLintUtils } from "@typescript-eslint/utils";

import * as noConstEnum from "../src/rules/prefer-declare-function";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("prefer-declare-function", noConstEnum, {
  invalid: [
    {
      code: `export const example: () => void;`,
      errors: [
        {
          column: 14,
          endColumn: 33,
          line: 1,
          messageId: "variableFunction",
        },
      ],
    },
    {
      code: `
        namespace N {
            export const example: () => void;
        }
`,
      errors: [
        {
          column: 26,
          endColumn: 45,
          line: 3,
          messageId: "variableFunction",
        },
      ],
    },
    {
      code: `
        namespace N {
            const example: () => void;
        }
`,
      errors: [
        {
          column: 19,
          endColumn: 38,
          line: 3,
          messageId: "variableFunction",
        },
      ],
    },
  ],
  valid: [`function example(): void`],
});
