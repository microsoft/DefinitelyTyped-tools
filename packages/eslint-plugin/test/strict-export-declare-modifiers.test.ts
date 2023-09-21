import { ESLintUtils } from "@typescript-eslint/utils";

import * as strictExportDeclareModifiers from "../src/rules/strict-export-declare-modifiers";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("strict-export-declare-modifiers", strictExportDeclareModifiers, {
  invalid: [
    {
      code: `declare interface I {}`,
      errors: [
        {
          column: 1,
          endColumn: 8,
          line: 1,
          messageId: "redundantDeclare",
        },
      ],
    },
    {
      code: `
declare namespace M {
    export const x: number;
}
      `,
      errors: [
        {
          column: 5,
          endColumn: 11,
          line: 3,
          messageId: "redundantExport",
        },
      ],
    },
    {
      code: `export declare function f(): void;`,
      errors: [
        {
          line: 1,
          messageId: "redundantDeclare",
        },
      ],
      filename: "testModuleAutoExport.d.ts",
    },
    {
      code: `
export namespace M {
  export function f(): void;
}
`,
      errors: [
        {
          column: 3,
          endColumn: 9,
          line: 3,
          messageId: "redundantExport",
        },
      ],
      filename: "testModuleAutoExport.d.ts",
    },
    {
      code: `
interface I {}
export namespace M {}
  `,
      errors: [
        {
          column: 11,
          endColumn: 12,
          line: 2,
          messageId: "missingExplicitExport",
        },
      ],
      filename: "testModuleAutoExport.d.ts",
    },
    {
      code: `
declare function g(): void;
export namespace M {}
    `,
      errors: [
        {
          column: 1,
          endColumn: 8,
          line: 2,
          messageId: "redundantDeclare",
        },
        {
          column: 18,
          endColumn: 19,
          line: 2,
          messageId: "missingExplicitExport",
        },
      ],
      filename: "testModuleAutoExport.d.ts",
    },
    {
      code: `
declare namespace N {}
export namespace M {}
      `,
      errors: [
        {
          column: 1,
          endColumn: 8,
          line: 2,
          messageId: "redundantDeclare",
        },
        {
          column: 19,
          endColumn: 20,
          line: 2,
          messageId: "missingExplicitExport",
        },
      ],
      filename: "testModuleAutoExport.d.ts",
    },
  ],
  valid: [
    `export declare class C {}`,
    `export function f() {}`,
    `declare function g(): void;`,
    `declare namespace N {};`,
    `interface J {}`,
    `
namespace N {
  export const x: number;
}
    `,
    {
      code: `
declare class Foo {}
export { Foo as Bar }
      `,
      filename: "./testValuesDeclareClass.d.ts",
    },
    {
      code: `
import * as foo from "foo";
import foo = require("foo");
export { foo };
export { foo } from "foo";
export as namespace Foo;
      `,
      filename: "testModule.d.ts",
    },
    {
      code: `
import * as foo from "foo";
import foo = require("foo");
export as namespace Foo;
      `,
      filename: "testModuleAutoExport.d.ts",
    },
  ],
});
