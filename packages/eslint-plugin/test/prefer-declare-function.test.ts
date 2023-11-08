import { RuleTester } from "@typescript-eslint/rule-tester";

import * as preferDeclareFunction from "../src/rules/prefer-declare-function";

const ruleTester = new RuleTester();

ruleTester.run("@definitelytyped/prefer-declare-function", preferDeclareFunction, {
  invalid: [
    {
      filename: "index.d.ts",
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
      filename: "index.d.ts",
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
      filename: "index.d.ts",
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
  valid: [
    {
      filename: "index.d.ts",
      code: `function example(): void`,
    },
    {
      filename: "test.ts",
      code: `export const example: () => void;`,
    },
  ],
});
