import { RuleTester } from "@typescript-eslint/rule-tester";

import * as noConstEnum from "../src/rules/no-const-enum";

const ruleTester = new RuleTester();

ruleTester.run("@definitelytyped/no-const-enum", noConstEnum, {
  invalid: [
    {
      code: ` const enum E { } `,
      errors: [
        {
          line: 1,
          messageId: "constEnum",
        },
      ],
    },
  ],
  valid: [` enum F {}`],
});
