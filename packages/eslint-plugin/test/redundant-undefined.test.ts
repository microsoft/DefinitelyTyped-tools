import { RuleTester } from "@typescript-eslint/rule-tester";

import * as redundantUndefined from "../src/rules/redundant-undefined";

const ruleTester = new RuleTester();

ruleTester.run("@definitelytyped/redundant-undefined", redundantUndefined, {
  invalid: [
    {
      code: `function f(s?: string | undefined): void {}`,
      errors: [
        {
          line: 1,
          messageId: "redundantUndefined",
        },
      ],
    },
    {
      code: `function f([a, b]?: [number, number] | undefined): void {}`,
      errors: [
        {
          line: 1,
          messageId: "redundantUndefined",
        },
      ],
    },
  ],
  valid: [
    `
interface I {
    ok?: string | undefined;
    s?: string;
    almost?: number | string;
}
`,
  ],
});
