import { ESLintUtils } from "@typescript-eslint/utils";

import rule from "../src/rules/no-relative-import-in-test";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.no-relative-import-in-test.json",
  },
});

ruleTester.run("no-relative-import-in-test", rule, {
  invalid: [
    {
      code: `import abc from "./no-relative-import-in-test/abc.d.ts";`,
      errors: [
        {
          line: 1,
          messageId: "useGlobalImport",
        },
      ],
      filename: "file.ts",
    },
  ],
  valid: [`import ts from "does-not-exist";`, `import ts from "typescript";`, `import other from "./does-not-exit";`],
});
