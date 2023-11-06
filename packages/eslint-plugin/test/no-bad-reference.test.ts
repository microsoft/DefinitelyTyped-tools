import { runTestsWithFixtures } from "./fixtureTester";
import * as rule from "../src/rules/no-bad-reference";

runTestsWithFixtures("@definitelytyped/no-bad-reference", rule, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-relative-references/index.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../foo/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "./v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../foo/v1/index.d.ts" } },
        { messageId: "importOutside", data: { text: "../foo" } },
        { messageId: "importOutside", data: { text: "./v1" } },
        { messageId: "importOutside", data: { text: "../foo/v1" } },
        { messageId: "importOutside", data: { text: "no-relative-references/v1" } },
      ],
    },
    {
      filename: "types/no-relative-references/other/other.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../../foo/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "importOutside", data: { text: "../../foo" } },
        { messageId: "importOutside", data: { text: "../v1" } },
        { messageId: "importOutside", data: { text: "../../foo/v1" } },
      ],
    },
    {
      filename: "types/no-relative-references/v1/index.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../../foo/index.d.ts" } },
        { messageId: "referenceLeaves", data: { text: "../v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../index.d.ts" } },
        { messageId: "importOutside", data: { text: "../../foo" } },
        { messageId: "importLeaves", data: { text: "../v1" } },
        { messageId: "importOutside", data: { text: "../../foo/v1" } },
        { messageId: "importOutside", data: { text: "../index" } },
        { messageId: "importOutside", data: { text: "../index" } },
      ],
    },
    {
      filename: "types/no-relative-references/v1/other/other.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../../../foo/index.d.ts" } },
        { messageId: "referenceLeaves", data: { text: "../../v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../../../foo/v1/index.d.ts" } },
        { messageId: "importOutside", data: { text: "../../../foo" } },
        { messageId: "importLeaves", data: { text: "../../v1" } },
        { messageId: "importOutside", data: { text: "../../../foo/v1" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/index.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../foo/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "./v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../foo/v1/index.d.ts" } },
        { messageId: "importOutside", data: { text: "../foo" } },
        { messageId: "importOutside", data: { text: "./v1" } },
        { messageId: "importOutside", data: { text: "../foo/v1" } },
        { messageId: "importOutside", data: { text: "@scoped/no-relative-references/v1" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/other/other.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../../foo/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "importOutside", data: { text: "../../foo" } },
        { messageId: "importOutside", data: { text: "../v1" } },
        { messageId: "importOutside", data: { text: "../../foo/v1" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/v1/index.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../../foo/index.d.ts" } },
        { messageId: "referenceLeaves", data: { text: "../v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../../foo/v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../index.d.ts" } },
        { messageId: "importOutside", data: { text: "../../foo" } },
        { messageId: "importLeaves", data: { text: "../v1" } },
        { messageId: "importOutside", data: { text: "../../foo/v1" } },
        { messageId: "importOutside", data: { text: "../index" } },
        { messageId: "importOutside", data: { text: "../index" } },
      ],
    },
    {
      filename: "types/scoped__no-relative-references/v1/other/other.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../../../foo/index.d.ts" } },
        { messageId: "referenceLeaves", data: { text: "../../v1/index.d.ts" } },
        { messageId: "referenceOutside", data: { text: "../../../foo/v1/index.d.ts" } },
        { messageId: "importOutside", data: { text: "../../../foo" } },
        { messageId: "importLeaves", data: { text: "../../v1" } },
        { messageId: "importOutside", data: { text: "../../../foo/v1" } },
      ],
    },
    {
      filename: "types/no-bad-reference/index.d.ts",
      errors: [
        { messageId: "referenceOutside", data: { text: "../other" } },
        { messageId: "referenceOutside", data: { text: "./v11" } },
        { messageId: "referenceOutside", data: { text: "./v11/index" } },
        { messageId: "referenceOutside", data: { text: "./v11/subdir/file" } },
        { messageId: "referenceOutside", data: { text: "./v0.1" } },
        { messageId: "referenceOutside", data: { text: "./v0.1/index" } },
        { messageId: "backslashes", line: 13 },
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
