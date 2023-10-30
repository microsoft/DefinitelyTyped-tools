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
      errors: [
        { messageId: "relativeReference", data: { text: "../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "./v1/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../foo/v1/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../foo" } },
        { messageId: "relativeImport", data: { text: "./v1" } },
        { messageId: "relativeImport", data: { text: "../foo/v1" } },
        { messageId: "relativeImport", data: { text: "no-relative-references/v1" } },
      ],
    },
    {
      filename: "types/no-relative-references/other/other.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../v1/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../foo" } },
        { messageId: "relativeImport", data: { text: "../v1" } },
        { messageId: "relativeImport", data: { text: "../../foo/v1" } },
      ],
    },
    {
      filename: "types/no-relative-references/v1/index.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../foo" } },
        { messageId: "relativeImport", data: { text: "../../foo/v1" } },
        { messageId: "relativeImport", data: { text: "../index" } },
        { messageId: "relativeImport", data: { text: "../index" } },
      ],
    },
    {
      filename: "types/no-relative-references/v1/other/other.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../../../foo/v1/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../../foo" } },
        { messageId: "relativeImport", data: { text: "../../../foo/v1" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/index.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "./v1/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../foo/v1/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../foo" } },
        { messageId: "relativeImport", data: { text: "./v1" } },
        { messageId: "relativeImport", data: { text: "../foo/v1" } },
        { messageId: "relativeImport", data: { text: "@scoped/no-relative-references/v1" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/other/other.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../v1/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../foo" } },
        { messageId: "relativeImport", data: { text: "../v1" } },
        { messageId: "relativeImport", data: { text: "../../foo/v1" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/v1/index.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../foo" } },
        { messageId: "relativeImport", data: { text: "../../foo/v1" } },
        { messageId: "relativeImport", data: { text: "../index" } },
        { messageId: "relativeImport", data: { text: "../index" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/v1/other/other.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../../../foo/v1/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../../foo" } },
        { messageId: "relativeImport", data: { text: "../../../foo/v1" } },
      ],
    },
    {
      filename: "types/no-bad-reference/index.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../other" } },
        { messageId: "relativeReference", data: { text: "./v11" } },
        { messageId: "relativeReference", data: { text: "./v11/index" } },
        { messageId: "relativeReference", data: { text: "./v11/subdir/file" } },
        { messageId: "relativeReference", data: { text: "./v0.1" } },
        { messageId: "relativeReference", data: { text: "./v0.1/index" } },
      ],
    },
    {
      filename: "types/no-bad-reference/no-bad-reference-tests.ts",
      errors: [
        { messageId: "testReference", data: { text: "../other" } },
        { messageId: "testReference", data: { text: "other" } },
      ],
    },
  ],
});
