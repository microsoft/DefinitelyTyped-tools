import { ESLintUtils } from "@typescript-eslint/utils";

import * as noBadReference from "../src/rules/no-bad-reference";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("@definitelytyped/no-bad-reference", noBadReference, {
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
    {
      code: `/// <reference path="./v11" />`,
      errors: [
        {
          column: 20,
          endColumn: 25,
          line: 1,
          messageId: "referencePathOldVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="./v11/index" />`,
      errors: [
        {
          column: 20,
          endColumn: 31,
          line: 1,
          messageId: "referencePathOldVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="./v11/subdir/file" />`,
      errors: [
        {
          column: 20,
          endColumn: 37,
          line: 1,
          messageId: "referencePathOldVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="./v0.1" />`,
      errors: [
        {
          column: 20,
          endColumn: 26,
          line: 1,
          messageId: "referencePathOldVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="./v0.1/index" />`,
      errors: [
        {
          column: 20,
          endColumn: 32,
          line: 1,
          messageId: "referencePathOldVersion",
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
      code: `/// <reference path="./v1gardenpath" />`,
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="./v1verb/other" />`,
      filename: "types.d.ts",
    },
    {
      code: `/// <reference path="other" />
/// <reference path="other2" />`,
      filename: "types.d.ts",
    },
  ],
});
