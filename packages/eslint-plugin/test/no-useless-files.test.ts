import { RuleTester } from "@typescript-eslint/rule-tester";
import * as noUselessFiles from "../src/rules/no-useless-files";

const ruleTester = new RuleTester();

ruleTester.run("@definitelytyped/no-useless-files", noUselessFiles, {
  invalid: [
    {
      code: `// I am useless`,
      errors: [
        {
          column: 1,
          line: 1,
          messageId: "noContent",
        },
      ],
    },
    {
      code: ``,
      errors: [
        {
          column: 1,
          line: 1,
          messageId: "noContent",
        },
      ],
    },
    {
      code: `/// <reference lib="baz" />`,
      errors: [
        {
          column: 1,
          line: 1,
          messageId: "noContent",
        },
      ],
    },
  ],
  valid: [`export default "I am useful";`, `/// <reference path="foo" />`, `/// <reference types="bar" />`],
});
