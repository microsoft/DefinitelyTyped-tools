const { findDtsName, findNames, retrieveNpmHomepageOrFail, checkNames, checkSource } = require("./index");
/**
 * @param {string} description
 * @param {{ [s: string]: () => void }} tests
 */
function suite(description, tests) {
    describe(description, () => {
        for (const k in tests) {
            test(k, tests[k], 10 * 1000);
        }
    })
}
suite("findParent", {
    absolutePath() {
        expect(findDtsName("~/dt/types/jquery/index.d.ts")).toBe("jquery")
    },
    relativePath() {
        expect(findDtsName("jquery/index.d.ts")).toBe("jquery")
    },
    currentDirectory() {
        expect(findDtsName("index.d.ts")).toBe("dts-critic")
    },
    relativeCurrentDirectory() {
        expect(findDtsName("./index.d.ts")).toBe("dts-critic")
    },
    emptyDirectory() {
        expect(findDtsName("")).toBe("dts-critic")
    },
})
suite("findNames", {
    absolutePathsBoth() {
        expect(findNames("jquery/index.d.ts", "~/dts-critic", undefined)).toEqual({
            dts: "jquery",
            src: "dts-critic",
            homepage: undefined,
            project: undefined
        })
    },
    currentDirectorySource() {
        expect(findNames("jquery/index.d.ts", ".", undefined)).toEqual({
            dts: "jquery",
            src: "dts-critic",
            homepage: undefined,
            project: undefined
        })
    },
    mistakenFileNameSource() {
        expect(findNames("jquery/index.d.ts", "/home/lol/oops.index.js", undefined)).toEqual({
            dts: "jquery",
            src: "lol",
            homepage: undefined,
            project: undefined
        })
    },
    trailingSlashSource() {
        expect(findNames("jquery/index.d.ts", "/home/lol/", undefined)).toEqual({
            dts: "jquery",
            src: "lol",
            homepage: undefined,
            project: undefined
        })
    },
    mismatchPackageFailNoHeader() {
        // surely parseltongue will never exist
        expect(() => findNames("parseltongue.d.ts", undefined, undefined)).toThrow(
            `d.ts file must have a matching npm package.
To resolve this error, either:
1. Change the name to match an npm package.
2. Add a Definitely Typed header with the first line


    // Type definitions for non-npm package parseltongue-browser

Add -browser to the end of your name to make sure it doesn't conflict with existing npm packages.

- OR -

3. Explicitly provide dts-critic with a source file. This is not allowed for submission to Definitely Typed.
`)
    },
    mismatchPackageFailNpmHeader() {
        // surely parseltongue will never exist
        expect(() => findNames("parseltongue.d.ts", undefined, {
                nonNpm: false,
                libraryName: "a",
                libraryMajorVersion: 1,
                libraryMinorVersion: 2,
                typeScriptVersion: "3.2",
                contributors: [],
                projects: ["welcome-to-zombo.com", "this-is-zombo.com"]
        })).toThrow(
            `d.ts file must have a matching npm package.
To resolve this error, either:
1. Change the name to match an npm package.
2. Add a Definitely Typed header with the first line


    // Type definitions for non-npm package parseltongue-browser

Add -browser to the end of your name to make sure it doesn't conflict with existing npm packages.

- OR -

3. Explicitly provide dts-critic with a source file. This is not allowed for submission to Definitely Typed.
`)
    },
    mismatchPackageFailNonNpmHeader() {
        // surely parseltongue will never exist
        expect(() => findNames("jquery.d.ts", undefined, {
                nonNpm: true,
                libraryName: "a",
                libraryMajorVersion: 1,
                libraryMinorVersion: 2,
                typeScriptVersion: "3.2",
                contributors: [],
                projects: ["welcome-to-zombo.com", "this-is-zombo.com"]
        })).toThrow(
            `The non-npm package 'jquery' conflicts with the existing npm package 'jquery'.
Try adding -browser to the end of the name to get

    jquery-browser
`)
    }
})
suite("retrieveNpmHomepageOrFail", {
    retrieveFailure() {
        // surely parseltongue will never exist
        expect(() => retrieveNpmHomepageOrFail("parseltongue")).toThrow(`parseltongue Not found`);
    },
    retrieveShelljs() {
        expect(retrieveNpmHomepageOrFail("shelljs")).toBe("http://github.com/shelljs/shelljs")
    }
})
suite("checkNames", {
    standaloneFail() {
        expect(() => checkNames({ dts: "a", src: "b" }, undefined)).toThrow("d.ts name 'a' must match source name 'b'.")
    },
    okWithJustHomepage() {
        expect(checkNames({ dts: "a", src: "a", homepage: "zombo.com" }, undefined)).toBeUndefined()
    },
    okWithJustHeader() {
        expect(checkNames({ dts: "a", src: "a" }, {
            nonNpm: false,
            libraryName: "a",
            libraryMajorVersion: 1,
            libraryMinorVersion: 2,
            typeScriptVersion: "3.2",
            contributors: [],
            projects: ["welcome-to-zombo.com", "this-is-zombo.com"]
        })).toBeUndefined()
    },
    homepageFail() {
        expect(() => checkNames({ dts: "a", src: "a", homepage: "zombo.com" }, {
            nonNpm: false,
            libraryName: "a",
            libraryMajorVersion: 1,
            libraryMinorVersion: 2,
            typeScriptVersion: "3.2",
            contributors: [],
            projects: ["welcome-to-zombo.com", "this-is-zombo.com"]
        })).toThrow(`At least one of the project urls listed in the header, ["welcome-to-zombo.com","this-is-zombo.com"], must match the homepage listed by npm, 'zombo.com'.
If your d.ts file is not for the npm package with URL zombo.com,
change the name by adding -browser to the end and change the first line
of the Definitely Typed header to

    // Type definitions for non-npm package a-browser`)
    }
});

suite("checkSource", {
    badExportDefault() {
        expect(() => checkSource(
            "foo",
            `function f() {}; export default f;`,
            `module.exports = function () {};`)).toThrow(
                "The types for foo specify 'export default' but the source does not mention 'default' anywhere.");
    },
    serverError500() {
        expect(checkSource(
            "foo",
            `function f() {}; export default f;`,
            `<title>500 Server Error</title>`)).toBeUndefined();
    },
    serverError524() {
        expect(checkSource(
            "foo",
            `function f() {}; export default f;`,
            `<title>unpkg.com | 524: A timeout occurred</title>`)).toBeUndefined();
    },
});
