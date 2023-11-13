import { RuleTester } from "@typescript-eslint/rule-tester";

import * as noAnyUnion from "../src/rules/no-any-union";

const ruleTester = new RuleTester();

ruleTester.run("@definitelytyped/no-any-union", noAnyUnion, {
  invalid: [
    {
      code: `export const y: string | any;`,
      errors: [
        {
          line: 1,
          messageId: "anyUnion",
        },
      ],
    },
  ],
  valid: [`export const x: any;`],
});
