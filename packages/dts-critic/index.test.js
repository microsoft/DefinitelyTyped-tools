const { findDtsName, findNames, retrieveNpmHomepageOrFail, check } = require("./index");
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
    async absolutePathsBoth() {
        expect(await findNames("jquery/index.d.ts", "~/dts-critic")).toEqual({
            dts: "jquery",
            src: "dts-critic",
            homepage: undefined,
            project: undefined
        })
    },
    async currentDirectorySource() {
        expect(await findNames("jquery/index.d.ts", ".")).toEqual({
            dts: "jquery",
            src: "dts-critic",
            homepage: undefined,
            project: undefined
        })
    },
    async mistakenFileNameSource() {
        expect(await findNames("jquery/index.d.ts", "/home/lol/oops.index.js")).toEqual({
            dts: "jquery",
            src: "lol",
            homepage: undefined,
            project: undefined
        })
    },
    async trailingSlashSource() {
        expect(await findNames("jquery/index.d.ts", "/home/lol/")).toEqual({
            dts: "jquery",
            src: "lol",
            homepage: undefined,
            project: undefined
        })
    }
})
suite("retrieveNpmHomepageOrFail", {
    async retrieveFailure() {
        expect.assertions(1);
        try {
            // surely parseltongue will never exist
            await retrieveNpmHomepageOrFail("parseltongue");
        }
        catch (e) {
            expect(e.message).toEqual(`404 - "{\\"error\\":\\"Not found\\"}"`);
        }
    },
    async retrieveShelljs() {
        expect(await retrieveNpmHomepageOrFail("shelljs")).toBe("http://github.com/shelljs/shelljs");
    }
})
suite("check", {
    standaloneFail() {
        expect(() => check({ dts: "a", src: "b" })).toThrow("d.ts name is 'a' but source name is 'b'.")
    },
    okWithJustHomepage() {
        expect(check({ dts: "a", src: "a", homepage: "zombo.com" })).toBeUndefined()
    },
    okWithJustHeader() {
        expect(check({ dts: "a", src: "a" }, {
            libraryName: "a",
            libraryMajorVersion: 1,
            libraryMinorVersion: 2,
            typeScriptVersion: "3.2",
            contributors: [],
            projects: ["welcome-to-zombo.com", "this-is-zombo.com"]
        })).toBeUndefined()
    },
    homepageFail() {
        expect(() => check({ dts: "a", src: "a", homepage: "zombo.com" }, {
            libraryName: "a",
            libraryMajorVersion: 1,
            libraryMinorVersion: 2,
            typeScriptVersion: "3.2",
            contributors: [],
            projects: ["welcome-to-zombo.com", "this-is-zombo.com"]
        })).toThrow("None of the project urls listed in the header match the homepage listed by npm, 'zombo.com'.")
    }
});
