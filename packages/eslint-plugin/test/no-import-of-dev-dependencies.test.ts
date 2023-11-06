import * as noImportDefaultOfDevDependencies from "../src/rules/no-import-of-dev-dependencies";
import { runTestsWithFixtures } from "./fixtureTester";

runTestsWithFixtures("@definitelytyped/no-import-of-dev-dependencies", noImportDefaultOfDevDependencies, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
    {
      filename: "types/no-import-of-dev-dependencies/index.d.ts",
    },
    {
      filename: "types/no-import-of-dev-dependencies/no-import-of-dev-dependencies-tests.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-import-of-dev-dependencies/bad.d.ts",
      errors: [
        { messageId: "noReferenceOfDevDependencies" },
        { messageId: "noReferenceOfDevDependencies" },
        { messageId: "noImportOfDevDependencies" },
        { messageId: "noImportOfDevDependencies" },
      ],
    },
  ],
});
