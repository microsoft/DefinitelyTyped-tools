import * as dtHeader from "../src/rules/no-self-import";
import { runTestsWithFixtures } from "./fixtureTester";

runTestsWithFixtures("@definitelytyped/no-self-import", dtHeader, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
    {
      filename: "types/no-self-import/index.d.ts",
    },
    {
      filename: "types/no-self-import/no-self-import-tests.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-self-import/bad.d.ts",
      errors: [
        { messageId: "useRelativeImport" },
        { messageId: "useRelativeImport" },
        { messageId: "useOnlyCurrentVersion" },
        { messageId: "useOnlyCurrentVersion" },
        { messageId: "useOnlyCurrentVersion" },
        { messageId: "useOnlyCurrentVersion" },
        { messageId: "useOnlyCurrentVersion" },
      ],
    },
  ],
});
