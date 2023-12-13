import { RuleTester } from "@typescript-eslint/rule-tester";

import * as npmNaming from "../src/rules/npm-naming";
import { ErrorKind, Mode } from "@definitelytyped/dts-critic";

const ruleTester = new RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("npm-naming", npmNaming, {
  invalid: [
    {
      code: `export default dtsCritic();`,
      errors: [
        {
          data: {
            error: `The declaration doesn't match the JavaScript module 'dts-critic'. Reason:
The declaration should use 'export =' syntax because the JavaScript source uses 'module.exports =' syntax and 'module.exports' can be called or constructed.

To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
            option: `["error",{"mode":"code","errors":[["NeedsExportEquals",false]]}]`,
          },
          column: 1,
          endColumn: 1,
          line: 1,
          endLine: 2,
          messageId: "error",
        },
      ],
      filename: "packages/eslint-plugin/test/types/dts-critic/index.d.ts",
      options: [{ mode: Mode.Code, errors: [[ErrorKind.NeedsExportEquals, true]] }],
    },
    {
      code: `// test content`,
      errors: [
        {
          data: {
            error: `Declaration file must have a matching npm package.
To resolve this error, either:
1. Change the name to match an npm package.
2. Add \`\"nonNpm\": true\` to the package.json to indicate that this is not an npm package.
   Ensure the package name is descriptive enough to avoid conflicts with future npm packages.`,
            option: `"off"`,
          },
          column: 1,
          endColumn: 1,
          line: 1,
          endLine: 2,
          messageId: "error",
        },
      ],
      filename: "packages/eslint-plugin/test/types/wenceslas/index.d.ts",
      options: [{ mode: Mode.NameOnly }],
    },
  ],
  valid: [],
});
