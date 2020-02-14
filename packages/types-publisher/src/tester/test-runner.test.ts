import { NpmInfo } from "../lib/npm-client";
import { AllPackages, NotNeededPackage, TypesDataFile } from "../lib/packages";
import { createTypingsVersionRaw, testo } from "../util/test";

import { checkNotNeededPackage, getNotNeededPackages, GitDiff } from "./test-runner";

const typesData: TypesDataFile = {
    jquery: createTypingsVersionRaw("jquery", [], []),
    known: createTypingsVersionRaw("known", [{ name: "jquery", version: { major: 1 }}], []),
    "known-test": createTypingsVersionRaw("known-test", [], ["jquery"]),
    "most-recent": createTypingsVersionRaw("most-recent", [{ name: "jquery", version: "*" }], []),
    unknown: createTypingsVersionRaw("unknown", [{ name: "COMPLETELY-UNKNOWN", version: { major: 1 }}], []),
    "unknown-test": createTypingsVersionRaw("unknown-test", [], ["WAT"]),
};

const jestNotNeeded = [
    new NotNeededPackage({ typingsPackageName: "jest", libraryName: "jest", asOfVersion: "100.0.0", sourceRepoURL: "jest.com" }),
];
const allPackages = AllPackages.from(typesData, jestNotNeeded);

const deleteJestDiffs: GitDiff[] = [
    { status: "M", file: "notNeededPackages.json" },
    { status: "D", file: "types/jest/index.d.ts" },
    { status: "D", file: "types/jest/jest-tests.d.ts" },
];

testo({
    ok() {
        expect(Array.from(getNotNeededPackages(allPackages, deleteJestDiffs))).toEqual(jestNotNeeded);
    },
    forgotToDeleteFiles() {
        expect(() =>
            Array.from(getNotNeededPackages(
                AllPackages.from({ jest: createTypingsVersionRaw("jest", [], []) }, jestNotNeeded),
                deleteJestDiffs))).toThrow("Please delete all files in jest");

    },
    tooManyDeletes() {
        expect(() => Array.from(getNotNeededPackages(allPackages, [{ status: "D", file: "oops.txt" }]))).toThrow(
            "Unexpected file deleted: oops.txt");
    },
    extraneousFile() {
        Array.from(getNotNeededPackages(allPackages, [
            { status: "A", file: "oooooooooooops.txt" },
            { status: "M", file: "notNeededPackages.json" },
            { status: "D", file: "types/jest/index.d.ts" },
            { status: "D", file: "types/jest/jest-tests.d.ts" },
        ]));
    },
    forgotToUpdateNotNeededJson() {
        expect(() => Array.from(getNotNeededPackages(AllPackages.from(typesData, []), [{status: "D", file: "types/jest/index.d.ts" }]))).toThrow(
            "Deleted package jest is not in notNeededPackages.json.");
    },
    scoped() {
        Array.from(getNotNeededPackages(
            AllPackages.from(
                typesData,
                [new NotNeededPackage({
                    typingsPackageName: "ember__object",
                    libraryName: "@ember/object",
                    asOfVersion: "1.0.0",
                    sourceRepoURL: "ember.js",
                })],
            ),
            [{ status: "D", file: "types/ember__object/index.d.ts" }]));
    },
    // TODO: Test npm info (and with scoped names)
    // TODO: Test with dependents, etc etc
});

const empty: NpmInfo = {
    distTags: new Map(),
    versions: new Map(),
    time: new Map(),
};
testo({
    missingSource() {
        expect(() => checkNotNeededPackage(jestNotNeeded[0], undefined, empty))
            .toThrow("The entry for @types/jest in notNeededPackages.json");
    },
    missingTypings() {
        expect(() => checkNotNeededPackage(jestNotNeeded[0], empty, undefined))
            .toThrow("@types package not found for @types/jest");
    },
    missingTypingsLatest() {
        expect(() => checkNotNeededPackage(jestNotNeeded[0], empty, empty))
            .toThrow("@types/jest is missing the \"latest\" tag");
    },
    deprecatedSameVersion() {
        expect(() => {
            checkNotNeededPackage(
                jestNotNeeded[0],
                empty,
                { distTags: new Map([["latest", "100.0.0"]]), versions: new Map(), time: new Map([["modified", ""]]) },
            );
        }).toThrow(`The specified version 100.0.0 of jest must be newer than the version
it is supposed to replace, 100.0.0 of @types/jest.`);
    },
    deprecatedOlderVersion() {
        expect(() => {
            checkNotNeededPackage(
                jestNotNeeded[0],
                empty,
                { distTags: new Map([["latest", "999.0.0"]]), versions: new Map(), time: new Map([["modified", ""]]) },
            );
        }).toThrow(`The specified version 100.0.0 of jest must be newer than the version
it is supposed to replace, 999.0.0 of @types/jest.`);
    },
    missingNpmVersion() {
        expect(() => {
            checkNotNeededPackage(
                jestNotNeeded[0],
                empty,
                { distTags: new Map([["latest", "4.0.0"]]), versions: new Map(), time: new Map([["modified", ""]]) },
            );
        }).toThrow("The specified version 100.0.0 of jest is not on npm.");
    },
    olderNpmVersion() {
        expect(() => checkNotNeededPackage(
            jestNotNeeded[0],
            { distTags: new Map(), versions: new Map([["50.0.0", {}]]), time: new Map([["modified", ""]]) },
            { distTags: new Map([["latest", "4.0.0"]]), versions: new Map(), time: new Map([["modified", ""]]) }))
            .toThrow("The specified version 100.0.0 of jest is not on npm.");
    },
    ok() {
        checkNotNeededPackage(
            jestNotNeeded[0],
            { distTags: new Map(), versions: new Map([["100.0.0", {}]]), time: new Map([["modified", ""]]) },
            { distTags: new Map([["latest", "4.0.0"]]), versions: new Map(), time: new Map([["modified", ""]]) });
    },
});
