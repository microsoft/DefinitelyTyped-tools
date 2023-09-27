import { ESLintUtils } from "@typescript-eslint/utils";
import path from "path";

import rule from "../src/rules/no-single-declare-module";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.no-single-declare-module.json",
  },
});

ruleTester.run("no-single-declare-module", rule, {
  invalid: [
    {
      code: `
        declare module "foo" {}

        // Other global declarations don't affect this. They should go in "declare global".
        interface I {}
      `,
      errors: [
        {
          line: 2,
          messageId: "oneModuleDeclaration",
        },
      ],
    },
  ],
  valid: [
    {
      code: `
        import x from "x";
        declare module "foo" {}
      `,
    },
    {
      code: `
        declare module "foo" {}
        declare module "bar" {}      
      `,
    },
    {
      code: `
        declare module "*.svg" {}
      `,
    },
  ],
});
