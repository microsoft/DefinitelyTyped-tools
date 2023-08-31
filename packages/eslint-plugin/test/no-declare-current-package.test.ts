import { ESLintUtils } from "@typescript-eslint/utils";

import * as noDeclareCurrentPackage from "../src/rules/no-declare-current-package";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
  },
});

ruleTester.run("@definitelytyped/no-declare-current-package", noDeclareCurrentPackage, {
  invalid: [
    {
      filename: "types/test/index.d.ts",
      code: `module "test" { }`,
      errors: [
        {
          line: 1,
          messageId: "noDeclareCurrentPackage",
        },
      ],
    },
    {
      filename: "types/test/deep/import.d.ts",
      code: `module "test/deep/import" { }`,
      errors: [
        {
          line: 1,
          messageId: "noDeclareCurrentPackage",
        },
      ],
    },
    {
      filename: "types/scope__name/index.d.ts",
      code: `module "@scope/name" { }`,
      errors: [
        {
          line: 1,
          messageId: "noDeclareCurrentPackage",
        },
      ],
    },
  ],
  valid: [
    {
      filename: "types/other/index.d.ts",
      code: `module "foo" { }`,
    },
    {
      filename: "types/other/index.d.ts",
      code: `module "foo/bar/baz" { }`,
    },
    {
      filename: "types/deep/other/index.d.ts",
      code: `module "other" { }`,
    },
  ],
});
