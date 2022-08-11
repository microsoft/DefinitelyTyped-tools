import { ESLintUtils } from "@typescript-eslint/utils";

import * as exportJustNamespace from "../src/rules/export-just-namespace";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("export-just-namespace", exportJustNamespace, {
  invalid: [
    {
      code: `export = stuff;`,
      errors: [
        {
          line: 1,
          messageId: "useTheBody",
        },
      ],
    },
  ],
  valid: [
    `export const value = 3;`,
    `export default class Hello {}`,
    'import * as fs from "fs";',
    "const value = 123;",
    `export = createStuff();`,
  ],
});
