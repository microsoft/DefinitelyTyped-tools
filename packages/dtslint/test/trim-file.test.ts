import { ESLintUtils } from "@typescript-eslint/utils";
import * as noUselessFiles from "../src/rules/trim-file";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("trim-file", noUselessFiles, {
  invalid: [
    {
      code: `
      globalThis`,
      errors: [
        {
          endColumn: 1,
          endLine: 1,
          column: 1,
          line: 1,
          messageId: "leading",
        },
      ],
    },
    {
      code: `globalThis

`,
      errors: [
        {
          endColumn: 1,
          endLine: 2,
          column: 1,
          line: 2,
          messageId: "trailing",
        },
      ],
    },
    {
      code: `
globalThis

`,
      errors: [
        {
          endColumn: 1,
          endLine: 1,
          column: 1,
          line: 1,
          messageId: "leading",
        },
        {
          endColumn: 1,
          endLine: 3,
          column: 1,
          line: 3,
          messageId: "trailing",
        },
      ],
    },
  ],
  valid: [
    `globalThis;`,
    `globalThis;
  `,
  ],
});
