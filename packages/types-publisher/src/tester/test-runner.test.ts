import { testo, createTypingsVersionRaw } from "../util/test";
import { AllPackages, NotNeededPackage, TypesDataFile } from "../lib/packages";
import { checkDeletedFiles, GitDiff } from "./test-runner";

const typesData: TypesDataFile = {
    jquery: createTypingsVersionRaw("jquery", [], []),
    known: createTypingsVersionRaw("known", [{ name: "jquery", majorVersion: 1 }], []),
    "known-test": createTypingsVersionRaw("known-test", [], ["jquery"]),
    "most-recent": createTypingsVersionRaw("most-recent", [{ name: "jquery", majorVersion: "*" }], []),
    unknown: createTypingsVersionRaw("unknown", [{ name: "COMPLETELY-UNKNOWN", majorVersion: 1 }], []),
    "unknown-test": createTypingsVersionRaw("unknown-test", [], ["WAT"]),
};

const jestNotNeeded = [
    new NotNeededPackage({ typingsPackageName: "jest", libraryName: "jest", asOfVersion: "100.0.0", sourceRepoURL: "jest.com" })
];
const allPackages = AllPackages.from(typesData, jestNotNeeded);

const deleteJestDiffs: GitDiff[] = [
    { status: "M", file: "notNeededPackages.json" },
    { status: "D", file: "types/jest/index.d.ts" },
    { status: "D", file: "types/jest/jest-tests.d.ts" },
];


testo({
    ok() {
        checkDeletedFiles(allPackages, deleteJestDiffs);
    },
    forgotToDeleteFiles() {
        expect(() =>
        checkDeletedFiles(
            AllPackages.from({ jest: createTypingsVersionRaw("jest", [], []) }, jestNotNeeded),
            deleteJestDiffs)).toThrow('Please delete all files in jest');

    },
    tooManyDeletes() {
        expect(() => checkDeletedFiles(allPackages, [{ status: "D", file: "oops.txt" }])).toThrow(
            "Unexpected file deleted: oops.txt");
    },
    extraneousFile() {
        checkDeletedFiles(allPackages, [
            { status: "A", file: "oooooooooooops.txt" },
            { status: "M", file: "notNeededPackages.json" },
            { status: "D", file: "types/jest/index.d.ts" },
            { status: "D", file: "types/jest/jest-tests.d.ts" },
        ]);
    },
    forgotToUpdateNotNeededJson() {
        expect(() => checkDeletedFiles(AllPackages.from(typesData, []), [{status: "D", file: "types/jest/index.d.ts" }])).toThrow(
            "Deleted package jest is not in notNeededPackages.json.");
    },
    scoped() {
        checkDeletedFiles(
            AllPackages.from(
                typesData,
                [new NotNeededPackage({ typingsPackageName: "ember__object", libraryName: "@ember/object", asOfVersion: "1.0.0", sourceRepoURL: "ember.js" })]),
            [{ status: "D", file: "types/ember__object/index.d.ts" }]);
    },
    // TODO: Test npm info (and with scoped names)
    // TODO: Test with dependents, etc etc
});
