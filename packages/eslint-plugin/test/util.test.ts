import { getTypesPackageForDeclarationFile } from "../src/util";

describe("getTypesPackageForDeclarationFile", () => {
  test.each([
    ["types/abc/index.d.ts", "abc"],
    ["types/abc/other.d.ts", "abc"],
    ["types/scope__abc/other.d.ts", "@scope/abc"],
    ["types/abc/nested/index.d.ts", "abc"],
    ["types/abc/nested/other.d.ts", "abc"],
    ["/types/abc/index.d.ts", "abc"],
    ["/types/abc/other.d.ts", "abc"],
    ["/types/scope__abc/other.d.ts", "@scope/abc"],
    ["/types/abc/nested/index.d.ts", "abc"],
    ["/types/abc/nested/other.d.ts", "abc"],
    ["DefinitelyTyped/types/abc/index.d.ts", "abc"],
    ["DefinitelyTyped/types/abc/other.d.ts", "abc"],
    ["DefinitelyTyped/types/scope__abc/other.d.ts", "@scope/abc"],
    ["DefinitelyTyped/types/abc/nested/index.d.ts", "abc"],
    ["DefinitelyTyped/types/abc/nested/other.d.ts", "abc"],
    ["DefinitelyTyped/types/scope__abc/nested/other.d.ts", "@scope/abc"],
  ])("%s becomes %s", (input, expected) => {
    expect(getTypesPackageForDeclarationFile(input)).toEqual(expected);
  });
});
