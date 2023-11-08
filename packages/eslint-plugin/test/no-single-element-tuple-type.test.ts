import { RuleTester } from "@typescript-eslint/rule-tester";

import * as noDeclareCurrentPackage from "../src/rules/no-single-element-tuple-type";

const ruleTester = new RuleTester();

ruleTester.run("@definitelytyped/no-single-element-tuple-type", noDeclareCurrentPackage, {
  invalid: [
    {
      code: `type Test<T> = [T];`,
      errors: [
        {
          line: 1,
          messageId: "singleElementTupleType",
        },
      ],
    },
  ],
  valid: [
    `type Test = number[];`,
    `type Test<T> = T;`,
    `type Test<T> = T[];`,
    `type Test<T> = [T, number];`,
    `type Test<T> = [T, T];`,
  ],
});
