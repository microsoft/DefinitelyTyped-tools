import { ESLintUtils } from "@typescript-eslint/utils";

import * as exportJustNamespace from "../src/rules/export-just-namespace";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("export-just-namespace", exportJustNamespace, {
  invalid: [
    {
      code: `
export = Stuff;
namespace Stuff {}
`,
      errors: [
        {
          line: 2,
          messageId: "useTheBody",
        },
      ],
    },
    {
      code: `
namespace Stuff {}
export = Stuff;
`,
      errors: [
        {
          line: 3,
          messageId: "useTheBody",
        },
      ],
    },
    {
      code: `
namespace Stuff {}
const other = "code";
export = Stuff;
`,
      errors: [
        {
          line: 4,
          messageId: "useTheBody",
        },
      ],
    },
  ],
  valid: [
    `export const value = 3;`,
    `export default class Hello {}`,
    'import * as fs from "fs";',
    "const value = 123;",
    `export = stuff;`,
    `export = createStuff();`,
    `
class Stuff {}
namespace Stuff {}
export = Stuff;
`,
    `export = First
namespace First {}
declare function First()
`,
    `declare namespace Second {}
export = Second
declare function Second<U, S>(s: U): S
`,
  ],
});
