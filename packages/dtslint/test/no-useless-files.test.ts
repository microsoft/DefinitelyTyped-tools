import { ESLintUtils } from "@typescript-eslint/utils";
import * as noUselessFiles from "../src/rules/no-useless-files";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("no-useless-files", noUselessFiles, {
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
  ],
  valid: [
    {
      code: `export default "I am useful";`,
    },
  ],
});
