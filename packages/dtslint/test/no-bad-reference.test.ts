import { ESLintUtils } from "@typescript-eslint/utils";

import * as noBadReference from "../src/rules/no-bad-reference";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("no-bad-reference", noBadReference, {
  invalid: [
    {
      code: `/// <reference path="../other" />`,
      errors: [
        {
          column: 20,
          endColumn: 28,
          line: 1,
          messageId: "referencePathTest",
        },
      ],
      filename: "types.ts",
    },
    {
      code: `/// <reference path="other" />`,
      errors: [
        {
          column: 20,
          endColumn: 25,
          line: 1,
          messageId: "referencePathTest",
        },
      ],
      filename: "types.ts",
    },
    {
      code: `/// <reference path="../other" />`,
      errors: [
        {
          column: 20,
          endColumn: 28,
          line: 1,
          messageId: "referencePathPackage",
        },
      ],
      filename: "types.d.ts",
    },
  ],
  valid: [
    ``,
    `// unrelated comment`,
    `/// similar (reference path) comment`,
    {
      code: `/// <reference path="other" />`,
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="./other" />`,
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="other" />
/// <reference path="other2" />`,
      filename: "types.d.ts",
    },
  ],
});
