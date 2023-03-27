import { ESLintUtils } from "@typescript-eslint/utils";

import * as noImportDefaultOfExportEquals from "../src/rules/no-import-default-of-export-equals";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: __dirname,
    project: "./tsconfig.no-import-default-of-export-equals.json",
  },
});

ruleTester.run("no-import-default-of-export-equals", noImportDefaultOfExportEquals, {
  invalid: [
    {
      filename: "index.d.ts",
      code: `declare module "a" {
    interface I {}
    export = I;
}

declare module "b" {
import a from "a";
}`,
      errors: [
        {
          line: 7,
          messageId: "noImportDefaultOfExportEquals",
        },
      ],
    },
  ],
  valid: [
    {
      filename: "index.d.ts",
      code: `declare module "a" {
    interface I {}
    export default I;
}

declare module "b" {
    import a from "a";
}
`,
    },
  ],
});
