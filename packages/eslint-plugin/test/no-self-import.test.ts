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
  ],
});
