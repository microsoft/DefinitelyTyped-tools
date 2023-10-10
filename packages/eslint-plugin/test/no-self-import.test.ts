import { ESLintUtils } from "@typescript-eslint/utils";

import * as dtHeader from "../src/rules/no-self-import";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("@definitelytyped/no-self-import", dtHeader, {
  invalid: [
    {
      code: `import myself from "this-package";`,
      errors: [
        {
          line: 1,
          messageId: "useRelativeImport",
        },
      ],
      filename: "types/this-package/index.d.ts",
    },
    {
      code: `import abc from "this-package/abc.d.ts";`,
      errors: [
        {
          line: 1,
          messageId: "useRelativeImport",
        },
      ],
      filename: "types/this-package/index.d.ts",
    },
    {
      code: `import old from "./v11"`,
      errors: [
        {
          column: 1,
          endColumn: 24,
          line: 1,
          messageId: "useOnlyCurrentVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `import old from "./v11/index"`,
      errors: [
        {
          column: 1,
          endColumn: 30,
          line: 1,
          messageId: "useOnlyCurrentVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `import old from "./v11/subdir/file"`,
      errors: [
        {
          column: 1,
          endColumn: 36,
          line: 1,
          messageId: "useOnlyCurrentVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `import old from "./v0.1"`,
      errors: [
        {
          column: 1,
          endColumn: 25,
          line: 1,
          messageId: "useOnlyCurrentVersion",
        },
      ],
      filename: "types.d.ts",
    },
    {
      code: `import old from "./v0.1/index"`,
      errors: [
        {
          column: 1,
          endColumn: 31,
          line: 1,
          messageId: "useOnlyCurrentVersion",
        },
      ],
      filename: "types.d.ts",
    },
  ],
  valid: [
    {
      code: `import other from "other-package";`,
      filename: "types/this-package/index.d.ts",
    },
    {
      code: `import other from "other-package/this-package";`,
      filename: "types/this-package/index.d.ts",
    },
    {
      code: `import myself from "this-package";`,
      filename: "types/grandparent/this-package/index.d.ts",
    },
    {
      code: `import old from "./v1gardenpath"`,
      filename: "types.d.ts",
    },
    {
      code: `import old from "./v1verb/other"`,
      filename: "types.d.ts",
    },
  ],
});
