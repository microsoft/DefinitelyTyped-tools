import * as noDeclareCurrentPackage from "../src/rules/no-declare-current-package";
import { runTestsWithFixtures } from "./fixtureTester";

runTestsWithFixtures("@definitelytyped/no-declare-current-package", noDeclareCurrentPackage, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
    {
      filename: "types/no-declare-current-package-other/index.d.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-declare-current-package/index.d.ts",
      errors: [{ messageId: "noDeclareCurrentPackage" }],
    },
    {
      filename: "types/no-declare-current-package/test/deep/import.d.ts",
      errors: [{ messageId: "noDeclareCurrentPackage" }],
    },
    {
      filename: "types/scoped__no-declare-current-package/index.d.ts",
      errors: [{ messageId: "noDeclareCurrentPackage" }],
    },
    {
      filename: "types/scoped__no-declare-current-package/test/deep/import.d.ts",
      errors: [{ messageId: "noDeclareCurrentPackage" }],
    },
  ],
});
