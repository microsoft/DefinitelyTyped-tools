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
      errors: [
        {
          messageId: "noDeclareCurrentPackage",
          data: { text: "no-declare-current-package", preferred: '"index.d.ts"' },
        },
      ],
    },
    {
      filename: "types/no-declare-current-package/test/deep/import.d.ts",
      errors: [
        {
          messageId: "noDeclareCurrentPackage",
          data: {
            text: "no-declare-current-package/deep/import",
            preferred:
              '"no-declare-current-package/deep/import.d.ts" or "no-declare-current-package/deep/import/index.d.ts"',
          },
        },
      ],
    },
    {
      filename: "types/scoped__no-declare-current-package/index.d.ts",
      errors: [
        {
          messageId: "noDeclareCurrentPackage",
          data: { text: "@scoped/no-declare-current-package", preferred: '"index.d.ts"' },
        },
      ],
    },
    {
      filename: "types/scoped__no-declare-current-package/test/deep/import.d.ts",
      errors: [
        {
          messageId: "noDeclareCurrentPackage",
          data: {
            text: "@scoped/no-declare-current-package/deep/import",
            preferred:
              '"@scoped/no-declare-current-package/deep/import.d.ts" or "@scoped/no-declare-current-package/deep/import/index.d.ts"',
          },
        },
      ],
    },
  ],
});
