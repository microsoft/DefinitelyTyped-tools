import { ESLintUtils } from "@typescript-eslint/utils";

import * as noAnyUnion from "../src/rules/no-any-union";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("no-any-union", noAnyUnion, {
  invalid: [
    {
      code: `export const y: string | any;`,
      errors: [
        {
          line: 1,
          messageId: "anyUnion",
        },
      ],
    },
  ],
  valid: [`export const x: any;`],
});
