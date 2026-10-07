import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "path";
import { findTypesPackage, getTypesPackageForDeclarationFile } from "../util";
import { fixtureRoot } from "./util";

function getFixturePath(filename: string): string {
  return path.join(fixtureRoot, filename);
}

describe("getTypesPackageForDeclarationFile", () => {
  for (const row of [
    ["types/foo/index.d.ts", "foo"],
    ["types/foo/foo-tests.ts", undefined],
    ["types/foo/v1/index.d.ts", "foo"],
    ["types/foo/v1/foo-tests.ts", undefined],
    ["types/scoped__foo/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/scoped__foo-tests.ts", undefined],
    ["types/scoped__foo/v1/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/scoped__foo-tests.ts", undefined],
    ["bad.d.ts", undefined],
  ] as const) {
    test(`${row[0]} becomes ${row[1]}`, () => {
      const [input, expected] = row;
      assert.deepEqual(getTypesPackageForDeclarationFile(getFixturePath(input)), expected);
    });
  }
});

describe("findTypesPackage realName", () => {
  for (const row of [
    ["types/foo/index.d.ts", "foo"],
    ["types/foo/foo-tests.ts", "foo"],
    ["types/foo/v1/index.d.ts", "foo"],
    ["types/foo/v1/foo-tests.ts", "foo"],
    ["types/scoped__foo/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/scoped__foo-tests.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/scoped__foo-tests.ts", "@scoped/foo"],
    ["bad.d.ts", undefined],
  ] as const) {
    test(`${row[0]} becomes ${row[1]}`, () => {
      const [input, expected] = row;
      const realName = findTypesPackage(getFixturePath(input))?.realName;
      assert.deepEqual(realName, expected);
    });
  }
});
