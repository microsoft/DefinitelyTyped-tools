import { ESLintUtils } from "@typescript-eslint/utils";

import * as noDeclareCurrentPackage from "../src/rules/no-declare-current-package";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: __dirname,
    project: "./tsconfig.json",
  }
});

ruleTester.run("no-declare-current-package", noDeclareCurrentPackage, {
  invalid: [
    {

      code: `module "test" { }`,
      errors: [
        {
          line: 1,
          messageId: "noDeclareCurrentPackage",
        },
      ],
    },
    {

      code: `module "test/deep/import" { }`,
      errors: [
        {
          line: 1,
          messageId: "noDeclareCurrentPackage",
        },
      ],
    },
  ],
  valid: [`
module "foo" { }
module "foo/bar/baz" { }
`],
});
