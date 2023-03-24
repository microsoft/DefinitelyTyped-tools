import { ESLintUtils } from "@typescript-eslint/utils";

import * as dtHeader from "../src/rules/no-redundant-jsdoc";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
  },
});

ruleTester.run("no-redundant-jsdoc", dtHeader, {
  invalid: [
    {
      only: true,
      code: `
        /** @private */
        let abc;
      `,
      errors: [
        {
          column: 4,
          endColumn: 11,
          data: {
            tag: "private",
          },
          line: 2,
          messageId: "redundantTag",
        },
      ],
      filename: "src/index.ts",
    },
  ],
  valid: [
    "/** unattached */",
    `
        /** abc */
        let def;
    `,
    `
        /** @deprecated */
        let abc;
    `,
    `
        /** @see x */
        let abc;
    `,
    `
        /** @author <Bjorn> look, nobody can remember the format for this thing */
        let abc;
    `,
  ],
});
