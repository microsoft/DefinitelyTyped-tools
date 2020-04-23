import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { parseHeaderOrFail, parseTypeScriptVersionLine, makeTypesVersionsForPackageJson } from "../src";

describe("parse", () => {
  it("works", () => {
    const src = dedent`
            // Type definitions for foo 1.2
            // Project: https://github.com/foo/foo, https://foo.com
            // Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
            // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
            // TypeScript Version: 2.2

            ...file content...`;
    expect(parseHeaderOrFail(src)).toStrictEqual({
      libraryName: "foo",
      libraryMajorVersion: 1,
      libraryMinorVersion: 2,
      typeScriptVersion: "2.2",
      nonNpm: false,
      projects: ["https://github.com/foo/foo", "https://foo.com"],
      contributors: [
        { name: "My Self", url: "https://github.com/me", githubUsername: "me" },
        { name: "Some Other Guy", url: "https://github.com/otherguy", githubUsername: "otherguy" }
      ]
    });
  });

  it("works with spacing", () => {
    const src = dedent`
            // Type definitions for foo 1.2
            // Project: https://github.com/foo/foo,
            //          https://foo.com
            // Definitions by: My Self <https://github.com/me>,
            //                 Some Other Guy <https://github.com/otherguy>
            // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

            ...file content...`;

    expect(parseHeaderOrFail(src)).toStrictEqual({
      libraryName: "foo",
      libraryMajorVersion: 1,
      libraryMinorVersion: 2,
      typeScriptVersion: "2.8",
      nonNpm: false,
      projects: ["https://github.com/foo/foo", "https://foo.com"],
      contributors: [
        { name: "My Self", url: "https://github.com/me", githubUsername: "me" },
        { name: "Some Other Guy", url: "https://github.com/otherguy", githubUsername: "otherguy" }
      ]
    });
  });

  it("works with slash end", () => {
    const src = dedent`
        // Type definitions for foo 1.2
        // Project: https://github.com/foo/foo,
        //          https://foo.com
        // Definitions by: My Self <https://github.com/me/>,
        //                 Some Other Guy <https://github.com/otherguy/>
        // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

        ...file content...`;

    expect(parseHeaderOrFail(src)).toStrictEqual({
      libraryName: "foo",
      libraryMajorVersion: 1,
      libraryMinorVersion: 2,
      typeScriptVersion: "2.8",
      nonNpm: false,
      projects: ["https://github.com/foo/foo", "https://foo.com"],
      contributors: [
        { name: "My Self", url: "https://github.com/me", githubUsername: "me" },
        { name: "Some Other Guy", url: "https://github.com/otherguy", githubUsername: "otherguy" }
      ]
    });
  });

  it("works with bad url", () => {
    const src = dedent`
            // Type definitions for foo 1.2
            // Project: https://github.com/foo/foo
            // Definitions by: Bad Url <sptth://hubgit.moc/em>
            // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped`;
    expect(parseHeaderOrFail(src).contributors).toStrictEqual([
      { name: "Bad Url", url: "sptth://hubgit.moc/em", githubUsername: undefined }
    ]);
  });

  it("allows 'non-npm' on Type definitions line", () => {
    const src = dedent`
            // Type definitions for non-npm package foo 1.2
            // Project: https://github.com/foo/foo, https://foo.com
            // Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
            // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
            // TypeScript Version: 2.2

            ...file content...`;
    expect(parseHeaderOrFail(src).nonNpm).toBe(true);
  });
});

describe("parseTypeScriptVersionLine", () => {
  it("works", () => {
    const src = "// TypeScript Version: 2.1";
    expect(parseTypeScriptVersionLine(src)).toBe("2.1");

    const minimum = "// Minimum TypeScript Version: 2.8";
    expect(parseTypeScriptVersionLine(minimum)).toBe("2.8");

    const wrong = "// TypeScript Version: 3.14";
    expect(() => parseTypeScriptVersionLine(wrong)).toThrow();
  });

  it("allows typescript 2.3", () => {
    const src = "// TypeScript Version: 2.3";
    expect(parseTypeScriptVersionLine(src)).toBe("2.3");
  });

  it("allows post 3 version tags", () => {
    const src = "// TypeScript Version: 3.0";
    expect(parseTypeScriptVersionLine(src)).toBe("3.0");
  });

  it("does not allow unallowed version tags", () => {
    const src = "// TypeScript Version: 4.7";
    expect(() => parseTypeScriptVersionLine(src)).toThrow(`Could not parse version: line is '${src}'`);
  });
});

describe("isSupported", () => {
  it("works", () => {
    expect(TypeScriptVersion.isSupported("3.5")).toBeTruthy();
  });
  it("supports 2.8", () => {
    expect(TypeScriptVersion.isSupported("2.8")).toBeTruthy();
  });
  it("does not support 2.7", () => {
    expect(!TypeScriptVersion.isSupported("2.7")).toBeTruthy();
  });
});

describe("range", () => {
  it("works", () => {
    expect(TypeScriptVersion.range("3.5")).toEqual(["3.5", "3.6", "3.7", "3.8", "3.9"]);
  });
  it("includes 2.8 onwards", () => {
    expect(TypeScriptVersion.range("2.8")).toEqual(TypeScriptVersion.supported);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    expect(TypeScriptVersion.tagsToUpdate("3.0")).toEqual([
      "ts3.0",
      "ts3.1",
      "ts3.2",
      "ts3.3",
      "ts3.4",
      "ts3.5",
      "ts3.6",
      "ts3.7",
      "ts3.8",
      "ts3.9",
      "latest"
    ]);
  });
  it("allows 2.8 onwards", () => {
    expect(TypeScriptVersion.tagsToUpdate("2.8")).toEqual(
      TypeScriptVersion.supported.map(s => "ts" + s).concat("latest")
    );
  });
});

describe("makeTypesVersionsForPackageJson", () => {
  it("is undefined for empty versions", () => {
    expect(makeTypesVersionsForPackageJson([])).toBeUndefined();
  });
  it("works for one version", () => {
    expect(makeTypesVersionsForPackageJson(["3.3"])).toEqual({
      ">=3.3.0-0": {
        "*": ["ts3.3/*"]
      }
    });
  });
  it("orders versions new to old with old-to-new input", () => {
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["3.2", "3.5", "3.6"]), undefined, 4)).toEqual(`{
    ">=3.6.0-0": {
        "*": [
            "ts3.6/*"
        ]
    },
    ">=3.5.0-0": {
        "*": [
            "ts3.5/*"
        ]
    },
    ">=3.2.0-0": {
        "*": [
            "ts3.2/*"
        ]
    }
}`);
  });
  it("orders versions new to old with new-to-old input", () => {
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["3.6", "3.5", "3.2"]), undefined, 4)).toEqual(`{
    ">=3.6.0-0": {
        "*": [
            "ts3.6/*"
        ]
    },
    ">=3.5.0-0": {
        "*": [
            "ts3.5/*"
        ]
    },
    ">=3.2.0-0": {
        "*": [
            "ts3.2/*"
        ]
    }
}`);
  });
});

function dedent(strings: TemplateStringsArray): string {
  expect(strings).toHaveLength(1);
  const x = strings[0].trim();
  return x.replace(/\n +/g, "\n");
}
