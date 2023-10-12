import { ESLintUtils } from "@typescript-eslint/utils";

import * as noImportDefaultOfDevDependencies from "../src/rules/no-import-of-dev-dependencies";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
  },
});

ruleTester.run("@definitelytyped/no-import-of-dev-dependencies", noImportDefaultOfDevDependencies, {
  invalid: [
    {
      filename: "index.d.ts",
      code: `import eslint from "eslint"`,
      errors: [
        {
          line: 1,
          messageId: "noImportOfDevDependencies",
        },
      ],
    },
    // test @types/ removal
    {
      filename: "index.d.ts",
      code: `import yargs from "yargs"`,
      errors: [
        {
          line: 1,
          messageId: "noImportOfDevDependencies",
        },
      ],
    },
    {
      filename: "index.d.ts",
      code: `/// <reference types="node" />`,
      errors: [
        {
          line: 1,
          messageId: "noReferenceOfDevDependencies",
        },
      ],
    },
  ],
  valid: [
    {
      filename: "index.d.ts",
      code: `import other from 'other'`,
    },
    {
      filename: "types/yargs/index.d.ts",
      code: `import self from "yargs"`,
    },
    {
      filename: "index.d.ts",
      code: `/// <reference types="other"/>`,
    },
    {
      filename: "test.ts",
      code: `import eslint from "eslint"`,
    },
    {
      filename: "test.ts",
      code: `import yargs from "yargs"`,
    },
    {
      filename: "test.ts",
      code: `/// <reference types="node" />`,
    },
  ],
});
