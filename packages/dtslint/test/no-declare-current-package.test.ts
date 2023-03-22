import { ESLintUtils } from "@typescript-eslint/utils";

import * as noDeclareCurrentPackage from "../src/rules/no-declare-current-package";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: __dirname,
    project: "./tsconfig.no-declare-current-package.json",
  }
});

ruleTester.run("no-declare-current-package", noDeclareCurrentPackage, {
  invalid: [
    {
      filename: "index.d.ts",
      code: `module "test" { }`,
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
      filename: "index.d.ts",
      code: `module "foo" { }
module "foo/bar/baz" { }
`}
  ],
});
// needed because you can only test one non-file.ts file per tsconfig
// (and tsconfig is required for typed-based rules)
const ruleTester2 = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: __dirname,
    project: "./tsconfig.no-declare-current-package2.json",
  }
});

ruleTester2.run("no-declare-current-package", noDeclareCurrentPackage, {
  invalid: [{
      filename: "deep/import.d.ts",
      code: `module "test/deep/import" { }`,
      errors: [
        {
          line: 1,
          messageId: "noDeclareCurrentPackage",
        },
      ],
    },
  ],
  valid: [],
});
