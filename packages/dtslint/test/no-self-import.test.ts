import { ESLintUtils } from "@typescript-eslint/utils";
import path from "path";

import * as dtHeader from "../src/rules/no-self-import";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.no-self-import.json",
  },
});

ruleTester.run("no-self-import", dtHeader, {
  invalid: [
    {
      code: `import myself from "this-package";`,
      errors: [
        {
          line: 1,
          messageId: "useRelativeImport",
        },
      ],
      filename: "this-package/index.d.ts",
    },
    {
      code: `import abc from "this-package/abc.d.ts";`,
      errors: [
        {
          line: 1,
          messageId: "useRelativeImport",
        },
      ],
      filename: "this-package/index.d.ts",
    },
  ],
  valid: [
    {
      code: `import other from "other-package";`,
      filename: "this-package/index.d.ts",
    },
    {
      code: `import other from "other-package/this-package";`,
      filename: "this-package/index.d.ts",
    },
  ],
});
