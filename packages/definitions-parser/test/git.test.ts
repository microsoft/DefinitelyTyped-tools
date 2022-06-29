import * as util from "util";
import * as pacote from "pacote";
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

jest.mock("pacote", () => ({
  async manifest(spec: string, opts: pacote.Options) {
    switch (spec) {
      case "jest@4.0.0": // Older than the @types/jest package.
      case "jest@50.0.0": // The same version as the @types/jest package.
      case "jest@100.0.0": // Newer than the @types/jest package.
        // These versions exist (don't throw).
        return;
      case "jest@999.0.0": // A nonexistent version of the replacement package.
        // eslint-disable-next-line no-throw-literal
        throw { code: "ETARGET" };
      case "@types/jest": // The @types/jest package.
        return { version: "50.0.0" };
      case "nonexistent@100.0.0": // A nonexistent replacement package.
      case "@types/nonexistent": // A nonexistent @types package.
        // eslint-disable-next-line no-throw-literal
        throw { code: opts.offline ? "ENOTCACHED" : "E404" };
    }
    throw new Error(`Unexpected npm registry fetch: ${util.inspect(spec)}`);
  },
}));

const newerReplacement = new NotNeededPackage("jest", "jest", "100.0.0");
const olderReplacement = new NotNeededPackage("jest", "jest", "4.0.0");
const sameVersion = new NotNeededPackage("jest", "jest", "50.0.0");
const nonexistentReplacementVersion = new NotNeededPackage("jest", "jest", "999.0.0");
const nonexistentReplacementPackage = new NotNeededPackage("jest", "nonexistent", "100.0.0");
const nonexistentTypesPackage = new NotNeededPackage("nonexistent", "jest", "100.0.0");

testo({
  missingSource() {
    return expect(checkNotNeededPackage(nonexistentReplacementPackage)).rejects.toThrow(
      "The entry for @types/jest in notNeededPackages.json"
    );
  },
  missingTypings() {
    return expect(checkNotNeededPackage(nonexistentTypesPackage)).rejects.toThrow(
      "@types package not found for @types/nonexistent"
    );
  },
  deprecatedSameVersion() {
    return expect(checkNotNeededPackage(sameVersion)).rejects
      .toThrow(`The specified version 50.0.0 of jest must be newer than the version
it is supposed to replace, 50.0.0 of @types/jest.`);
  },
  deprecatedOlderVersion() {
    return expect(checkNotNeededPackage(olderReplacement)).rejects
      .toThrow(`The specified version 4.0.0 of jest must be newer than the version
it is supposed to replace, 50.0.0 of @types/jest.`);
  },
  missingNpmVersion() {
    return expect(checkNotNeededPackage(nonexistentReplacementVersion)).rejects.toThrow(
      "The specified version 999.0.0 of jest is not on npm."
    );
  },
  ok() {
    return checkNotNeededPackage(newerReplacement);
  },
});
