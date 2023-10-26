import { runTestsWithFixtures } from "./fixtureTester";
import * as noRelativeReferences from "../src/rules/no-relative-references";

runTestsWithFixtures("@definitelytyped/no-relative-references", noRelativeReferences, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-relative-references/index.d.ts",
      errors: [{ messageId: "oops" }, { messageId: "oops" }],
    },
    {
      filename: "types/no-relative-references/v1/index.d.ts",
      errors: [{ messageId: "oops" }, { messageId: "oops" }, { messageId: "oops" }, { messageId: "oops" }],
    },
  ],
});
