import path from "path";
import { findTypesPackage, getTypesPackageForDeclarationFile } from "../src/util";
import { fixtureRoot } from "./util";

function getFixturePath(filename: string): string {
  return path.join(fixtureRoot, filename);
}

describe("getTypesPackageForDeclarationFile", () => {
  test.each([
    ["types/foo/index.d.ts", "foo"],
    ["types/foo/foo-tests.ts", undefined],
    ["types/foo/v1/index.d.ts", "foo"],
    ["types/foo/v1/foo-tests.ts", undefined],
    ["types/scoped__foo/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/scoped__foo-tests.ts", undefined],
    ["types/scoped__foo/v1/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/scoped__foo-tests.ts", undefined],
    ["bad.d.ts", undefined],
  ])("%s becomes %s", (input, expected) => {
    expect(getTypesPackageForDeclarationFile(getFixturePath(input))).toEqual(expected);
  });
});

describe("findTypesPackage realName", () => {
  test.each([
    ["types/foo/index.d.ts", "foo"],
    ["types/foo/foo-tests.ts", "foo"],
    ["types/foo/v1/index.d.ts", "foo"],
    ["types/foo/v1/foo-tests.ts", "foo"],
    ["types/scoped__foo/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/scoped__foo-tests.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/scoped__foo-tests.ts", "@scoped/foo"],
    ["bad.d.ts", undefined],
  ])("%s becomes %s", (input, expected) => {
    const realName = findTypesPackage(getFixturePath(input))?.realName;
    expect(realName).toEqual(expected);
  });
});
