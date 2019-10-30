import assert = require("assert");
import { parseHeaderOrFail, parseTypeScriptVersionLine, TypeScriptVersion } from "..";

describe("parse", () => {
    it("works", () => {
        const src = dedent`
            // Type definitions for foo 1.2
            // Project: https://github.com/foo/foo, https://foo.com
            // Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
            // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
            // TypeScript Version: 2.2

            ...file content...`;
        assert.deepStrictEqual(parseHeaderOrFail(src), {
            libraryName: "foo",
            libraryMajorVersion: 1,
            libraryMinorVersion: 2,
            typeScriptVersion: "2.2",
            nonNpm: false,
            projects: ["https://github.com/foo/foo", "https://foo.com"],
            contributors: [
                { name: "My Self", url: "https://github.com/me", githubUsername: "me" },
                { name: "Some Other Guy", url: "https://github.com/otherguy", githubUsername: "otherguy" },
            ],
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

        assert.deepStrictEqual(parseHeaderOrFail(src), {
            libraryName: "foo",
            libraryMajorVersion: 1,
            libraryMinorVersion: 2,
            typeScriptVersion: "2.0",
            nonNpm: false,
            projects: ["https://github.com/foo/foo", "https://foo.com"],
            contributors: [
                { name: "My Self", url: "https://github.com/me", githubUsername: "me" },
                { name: "Some Other Guy", url: "https://github.com/otherguy", githubUsername: "otherguy" },
            ],
        });
    });

    it("works with bad url", () => {
        const src = dedent`
            // Type definitions for foo 1.2
            // Project: https://github.com/foo/foo
            // Definitions by: Bad Url <sptth://hubgit.moc/em>
            // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped`;
        assert.deepStrictEqual(parseHeaderOrFail(src).contributors, [
            { name: "Bad Url", url: "sptth://hubgit.moc/em", githubUsername: undefined },
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
        assert.equal(parseHeaderOrFail(src).nonNpm, true);
    });
});

describe("parseTypeScriptVersionLine", () => {
    it("works", () => {
        const src = "// TypeScript Version: 2.1";
        assert.equal(parseTypeScriptVersionLine(src), "2.1");

        const wrong = "// TypeScript Version: 3.14";
        assert.throws(() => parseTypeScriptVersionLine(wrong));
    });

    it("allows typescript 2.3", () => {
        const src = "// TypeScript Version: 2.3";
        assert.equal(parseTypeScriptVersionLine(src), "2.3");
    });

    it("allows post 3 version tags", () => {
        const src = "// TypeScript Version: 3.0";
        assert.equal(parseTypeScriptVersionLine(src), "3.0");
    });

    it("does not allow unallowed version tags", () => {
        const src = "// TypeScript Version: 4.7";
        assert.throws(() => parseTypeScriptVersionLine(src), `Could not parse version: line is ${src}`);
    });
});

describe("tagsToUpdate", () => {
    it("works", () => {
        assert.deepEqual(
            TypeScriptVersion.tagsToUpdate("2.5"),
            ["ts2.5", "ts2.6", "ts2.7", "ts2.8", "ts2.9",
             "ts3.0", "ts3.1", "ts3.2", "ts3.3", "ts3.4", "ts3.5", "ts3.6", "ts3.7", "ts3.8", "latest"]);
    });
});

function dedent(strings: TemplateStringsArray): string {
    assert.equal(strings.length, 1);
    const x = strings[0].trim();
    return x.replace(/\n +/g, "\n");
}
