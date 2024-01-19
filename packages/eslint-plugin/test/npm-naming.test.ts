import { RuleTester } from "@typescript-eslint/rule-tester";

import * as npmNaming from "../src/rules/npm-naming";
import { ErrorKind } from "@definitelytyped/dts-critic";

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
            option: `["error",{"errors":[["NeedsExportEquals",false]]}]`,
          },
          column: 1,
          endColumn: 1,
          line: 1,
          endLine: 2,
          messageId: "error",
        },
      ],
      filename: "packages/eslint-plugin/test/types/dts-critic/index.d.ts",
      options: [{
        implementationPackageDirectory: "packages/eslint-plugin/test/types/dts-critic",
        errors: [[ErrorKind.NeedsExportEquals, true]]
      }],
    },
  ],
  valid: [],
});
