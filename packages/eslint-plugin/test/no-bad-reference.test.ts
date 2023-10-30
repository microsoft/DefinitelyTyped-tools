import * as noBadReference from "../src/rules/no-bad-reference";
import { runTestsWithFixtures } from "./fixtureTester";

runTestsWithFixtures("@definitelytyped/no-bad-reference", noBadReference, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-bad-reference/index.d.ts",
      errors: [
        {
          messageId: "referencePathPackage",
          line: 1,
          column: 20,
          endColumn: 28,
        },
        {
          messageId: "referencePathOldVersion",
          line: 2,
          column: 20,
          endColumn: 25,
        },
        {
          messageId: "referencePathOldVersion",
          line: 3,
          column: 20,
          endColumn: 31,
        },
        {
          messageId: "referencePathOldVersion",
          line: 4,
          column: 20,
          endColumn: 37,
        },
        {
          messageId: "referencePathOldVersion",
          line: 5,
          column: 20,
          endColumn: 26,
        },
        {
          messageId: "referencePathOldVersion",
          line: 6,
          column: 20,
          endColumn: 32,
        },
      ],
    },
    {
      filename: "types/no-bad-reference/no-bad-reference-tests.ts",
      errors: [{ messageId: "referencePathTest" }, { messageId: "referencePathTest" }],
    },
  ],
});
