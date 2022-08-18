import { ESLintUtils } from "@typescript-eslint/utils";

import * as noConstEnum from "../src/rules/no-const-enum";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("no-const-enum", noConstEnum, {
  invalid: [
    {
      code: ` const enum E { } `,
      errors: [
        {
          line: 1,
          messageId: "constEnum",
        },
      ],
    },
  ],
  valid: [` enum F {}`],
});
