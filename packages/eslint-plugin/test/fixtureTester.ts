import { TSESLint, ESLintUtils } from "@typescript-eslint/utils";
import path from "path";
import fs from "fs";

export const fixtureRoot = path.join(__dirname, "fixtures");

export function getFixturePath(filename: string): string {
  return path.join(fixtureRoot, filename);
}

type ValidTestCase<TOptions extends Readonly<unknown[]>> = Omit<
  TSESLint.ValidTestCase<TOptions>,
  "code" | "filename"
> & {
  filename: string;
};

type InvalidTestCase<TMessageIds extends string, TOptions extends Readonly<unknown[]>> = Omit<
  TSESLint.InvalidTestCase<TMessageIds, TOptions>,
  "code" | "filename"
> & {
  filename: string;
};

interface RunTests<TMessageIds extends string, TOptions extends Readonly<unknown[]>> {
  readonly valid: readonly ValidTestCase<TOptions>[];
  readonly invalid: readonly InvalidTestCase<TMessageIds, TOptions>[];
}

function convertTestCase<TOptions extends Readonly<unknown[]>>(
  test: ValidTestCase<TOptions>
): TSESLint.ValidTestCase<TOptions>;
function convertTestCase<TMessageIds extends string, TOptions extends Readonly<unknown[]>>(
  test: InvalidTestCase<TMessageIds, TOptions>
): TSESLint.InvalidTestCase<TMessageIds, TOptions>;
function convertTestCase<
  TMessageIds extends string,
  TOptions extends Readonly<unknown[]>,
  T extends ValidTestCase<TOptions> | InvalidTestCase<TMessageIds, TOptions>
>(test: T): TSESLint.ValidTestCase<TOptions> | TSESLint.InvalidTestCase<TMessageIds, TOptions> {
  const fixture = getFixturePath(test.filename);
  const code = fs.readFileSync(fixture, "utf8");
  return {
    name: test.filename,
    ...test,
    code,
    filename: fixture,
  };
}

export function runTestsWithFixtures<TMessageIds extends string, TOptions extends Readonly<unknown[]>>(
  name: string,
  rule: TSESLint.RuleModule<TMessageIds, TOptions>,
  tests: RunTests<TMessageIds, TOptions>
): void {
  const ruleTester = new ESLintUtils.RuleTester({
    parser: "@typescript-eslint/parser",
  });

  return ruleTester.run(name, rule, {
    valid: tests.valid.map(convertTestCase<TOptions>),
    invalid: tests.invalid.map(convertTestCase<TMessageIds, TOptions>),
  });
}
