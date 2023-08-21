import { ESLintUtils } from "@typescript-eslint/utils";

import * as noDeadReference from "../src/rules/no-dead-reference";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("no-dead-reference", noDeadReference, {
  invalid: [
    {
      code: `
export class C { }
/// <reference types="terms" />
`,
      errors: [
        {
          line: 3,
          messageId: "referenceAtTop",
        },
      ],
    },
    {
      code: `
export class C { }
/// <reference types="terms" />
/// <reference types="multiple" />
`,
      errors: [
        {
          line: 3,
          messageId: "referenceAtTop",
        },
        {
          line: 4,
          messageId: "referenceAtTop",
        },
      ],
    },
    {
      code: `
export class C { }
/// <reference types="terms" />
export class D { }
/// <reference types="multiple" />
export class E { }
`,
      errors: [
        {
          line: 3,
          messageId: "referenceAtTop",
        },
        {
          line: 5,
          messageId: "referenceAtTop",
        },
      ],
    },
  ],
  valid: [
    `
/// <reference types="tones" />
export class K {}
`,
  ],
});
