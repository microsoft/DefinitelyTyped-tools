import { ESLintUtils } from "@typescript-eslint/utils";

import * as rule from "../src/rules/no-unnecessary-generics";

const ruleTester = new ESLintUtils.RuleTester({
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: __dirname,
    project: "./tsconfig.test.json",
  },
  parser: "@typescript-eslint/parser",
});

ruleTester.run("@definitelytyped/no-unnecessary-generics", rule, {
  invalid: [
    {
      code: `
const f2 = <T>(): T => {};
      `,
      errors: [
        {
          line: 2,
          column: 13,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
class C {
  constructor<T>(x: T) {}
}
      `,
      errors: [
        {
          line: 3,
          column: 15,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
function f<T>(): T { }
      `,
      errors: [
        {
          line: 2,
          column: 12,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
function f<T>(x: { T: number }): void;
      `,
      errors: [
        {
          line: 2,
          column: 12,
          messageId: "never",
        },
      ],
    },
    {
      code: `
function f<T, U extends T>(u: U): U;
      `,
      errors: [
        {
          line: 2,
          column: 12,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
const f = function<T>(): T {};
      `,
      errors: [
        {
          line: 2,
          column: 20,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
interface I {
  <T>(value: T): void;
}
      `,
      errors: [
        {
          line: 3,
          column: 4,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
interface I {
  m<T>(x: T): void;
}
  `,
      errors: [
        {
          line: 3,
          column: 5,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
type Fn = <T>() => T;
  `,
      errors: [
        {
          line: 2,
          column: 12,
          messageId: "sole",
        },
      ],
    },
    {
      code: `
type Ctr = new<T>() => T;
  `,
      errors: [
        {
          line: 2,
          column: 16,
          messageId: "sole",
        },
      ],
    },
  ],
  valid: [
    `function example(a: string): string;`,
    `function example<T>(a: T): T;`,
    `function example<T>(a: T[]): T;`,
    `function example<T>(a: Set<T>): T;`,
    `function example<T>(a: Set<T>, b: T[]): void;`,
    `function example<T>(a: Map<T, T>): void;`,
    `function example<T, U extends T>(t: T, u: U): U;`,
  ],
});
