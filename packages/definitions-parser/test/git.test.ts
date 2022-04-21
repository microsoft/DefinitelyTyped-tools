import { NpmInfo } from "@definitelytyped/utils";
import { createTypingsVersionRaw, testo } from "./utils";
import { GitDiff, getNotNeededPackages, checkNotNeededPackage } from "../src/git";
import { NotNeededPackage, TypesDataFile, AllPackages } from "../src/packages";

const typesData: TypesDataFile = {
  jquery: createTypingsVersionRaw("jquery", {}, [], {}),
  known: createTypingsVersionRaw("known", { jquery: { major: 1 } }, [], {}),
  "known-test": createTypingsVersionRaw("known-test", {}, ["jquery"], {}),
  "most-recent": createTypingsVersionRaw("most-recent", { jquery: "*" }, [], {}),
  unknown: createTypingsVersionRaw("unknown", { "COMPLETELY-UNKNOWN": { major: 1 } }, [], {}),
  "unknown-test": createTypingsVersionRaw("unknown-test", {}, ["WAT"], {}),
};

const jestNotNeeded = [new NotNeededPackage("jest", "jest", "100.0.0")];
const allPackages = AllPackages.from(typesData, jestNotNeeded);

const deleteJestDiffs: GitDiff[] = [
  { status: "M", file: "notNeededPackages.json" },
  { status: "D", file: "types/jest/index.d.ts" },
  { status: "D", file: "types/jest/jest-tests.d.ts" },
];

testo({
  ok() {
    expect(getNotNeededPackages(allPackages, deleteJestDiffs)).toEqual(jestNotNeeded);
  },
  forgotToDeleteFiles() {
    expect(() =>
      getNotNeededPackages(
        AllPackages.from({ jest: createTypingsVersionRaw("jest", {}, [], {}) }, jestNotNeeded),
        deleteJestDiffs
      )
    ).toThrow("Please delete all files in jest");
  },
  tooManyDeletes() {
    expect(() => getNotNeededPackages(allPackages, [{ status: "D", file: "oops.txt" }])).toThrow(
      "Unexpected file deleted: oops.txt"
    );
  },
  deleteInOtherPackage() {
    expect(
      getNotNeededPackages(allPackages, [...deleteJestDiffs, { status: "D", file: "types/most-recent/extra-tests.ts" }])
    ).toEqual(jestNotNeeded);
  },
  extraneousFile() {
    expect(
      getNotNeededPackages(allPackages, [
        { status: "A", file: "oooooooooooops.txt" },
        { status: "M", file: "notNeededPackages.json" },
        { status: "D", file: "types/jest/index.d.ts" },
        { status: "D", file: "types/jest/jest-tests.d.ts" },
      ])
    ).toEqual(jestNotNeeded);
  },
  scoped() {
    expect(
      getNotNeededPackages(
        AllPackages.from(typesData, [new NotNeededPackage("ember__object", "@ember/object", "1.0.0")]),
        [{ status: "D", file: "types/ember__object/index.d.ts" }]
      )
    ).toEqual([new NotNeededPackage("ember__object", "@ember/object", "1.0.0")]);
  },
  // TODO: Test npm info (and with scoped names)
  // TODO: Test with dependents, etc etc
});

const empty: NpmInfo = {
  homepage: "",
  distTags: new Map(),
  versions: new Map(),
  time: new Map(),
};
testo({
  missingSource() {
    expect(() => checkNotNeededPackage(jestNotNeeded[0], undefined, empty)).toThrow(
      "The entry for @types/jest in notNeededPackages.json"
    );
  },
  missingTypings() {
    expect(() => checkNotNeededPackage(jestNotNeeded[0], empty, undefined)).toThrow(
      "@types package not found for @types/jest"
    );
  },
  missingTypingsLatest() {
    expect(() => checkNotNeededPackage(jestNotNeeded[0], empty, empty)).toThrow(
      '@types/jest is missing the "latest" tag'
    );
  },
  deprecatedSameVersion() {
    expect(() => {
      checkNotNeededPackage(jestNotNeeded[0], empty, {
        homepage: "jest.com",
        distTags: new Map([["latest", "100.0.0"]]),
        versions: new Map(),
        time: new Map([["modified", ""]]),
      });
    }).toThrow(`The specified version 100.0.0 of jest must be newer than the version
it is supposed to replace, 100.0.0 of @types/jest.`);
  },
  deprecatedOlderVersion() {
    expect(() => {
      checkNotNeededPackage(jestNotNeeded[0], empty, {
        homepage: "jest.com",
        distTags: new Map([["latest", "999.0.0"]]),
        versions: new Map(),
        time: new Map([["modified", ""]]),
      });
    }).toThrow(`The specified version 100.0.0 of jest must be newer than the version
it is supposed to replace, 999.0.0 of @types/jest.`);
  },
  missingNpmVersion() {
    expect(() => {
      checkNotNeededPackage(jestNotNeeded[0], empty, {
        homepage: "jest.com",
        distTags: new Map([["latest", "4.0.0"]]),
        versions: new Map(),
        time: new Map([["modified", ""]]),
      });
    }).toThrow("The specified version 100.0.0 of jest is not on npm.");
  },
  olderNpmVersion() {
    expect(() =>
      checkNotNeededPackage(
        jestNotNeeded[0],
        {
          homepage: "jest.com",
          distTags: new Map(),
          versions: new Map([["50.0.0", {}]]),
          time: new Map([["modified", ""]]),
        },
        {
          homepage: "jest.com",
          distTags: new Map([["latest", "4.0.0"]]),
          versions: new Map(),
          time: new Map([["modified", ""]]),
        }
      )
    ).toThrow("The specified version 100.0.0 of jest is not on npm.");
  },
  ok() {
    checkNotNeededPackage(
      jestNotNeeded[0],
      {
        homepage: "jest.com",
        distTags: new Map(),
        versions: new Map([["100.0.0", {}]]),
        time: new Map([["modified", ""]]),
      },
      {
        homepage: "jest.com",
        distTags: new Map([["latest", "4.0.0"]]),
        versions: new Map(),
        time: new Map([["modified", ""]]),
      }
    );
  },
});
