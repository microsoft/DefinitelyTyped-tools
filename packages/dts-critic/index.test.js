const { findDtsName, findNames } = require("./index");
/**
 * @param {string} description
 * @param {{ [s: string]: () => void }} tests
 */
function suite(description, tests) {
    describe(description, () => {
        for (const k in tests) {
            test(k, tests[k], 100);
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
        expect(await findNames("jquery/index.d.ts", "~/dts-critic")).toEqual(["jquery", "dts-critic", undefined])
    },
    async currentDirectorySource() {
        expect(await findNames("jquery/index.d.ts", ".")).toEqual(["jquery", "dts-critic", undefined])
    },
    async mistakenFileNameSource() {
        expect(await findNames("jquery/index.d.ts", "/home/lol/oops.index.js")).toEqual(["jquery", "lol", undefined])
    },
    async trailingSlashSource() {
        expect(await findNames("jquery/index.d.ts", "/home/lol/")).toEqual(["jquery", "lol", undefined])
    }
})
