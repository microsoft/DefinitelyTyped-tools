import * as util from "util";
import * as pacote from "pacote";
import { createTypingsVersionRaw, testo } from "./utils";
import { GitDiff, getNotNeededPackages, checkNotNeededPackage, gitChanges } from "../src/git";
import { NotNeededPackage, AllPackages, PackageId } from "../src/packages";

const typesData = {
  jquery: createTypingsVersionRaw("jquery", {}, {}),
  known: createTypingsVersionRaw("known", { "@types/jquery": "1.0.0" }, {}),
  "known-test": createTypingsVersionRaw("known-test", {}, { "@types/jquery": "*" }),
  "most-recent": createTypingsVersionRaw("most-recent", { "@types/jquery": "*" }, {}),
  unknown: createTypingsVersionRaw("unknown", { "@types/COMPLETELY-UNKNOWN": "1.0.0" }, {}),
  "unknown-test": createTypingsVersionRaw("unknown-test", {}, { "@types/WAT": "*" }),
};

const jestNotNeeded = [new NotNeededPackage("jest", "jest", "100.0.0")];
const allPackages = AllPackages.fromTestData(typesData, jestNotNeeded);

const deleteJestDiffs: GitDiff[] = [
  { status: "M", file: "notNeededPackages.json" },
  { status: "D", file: "types/jest/index.d.ts" },
  { status: "D", file: "types/jest/jest-tests.d.ts" },
];
const moveRdfJSDiffs: GitDiff[] = [
  { status: "D", file: "types/rdf-ext/ClownfaceFactory.d.ts" },
  { status: "A", file: "types/rdf-ext/FetchFactory.d.ts" },
  { status: "A", file: "types/rdf-ext/FormatsFactory.d.ts" },
  { status: "M", file: "types/rdf-ext/index.d.ts" },
  { status: "M", file: "types/rdf-ext/package.json" },
  { status: "M", file: "types/rdf-ext/rdf-ext-tests.ts" },
  { status: "D", file: "types/rdfjs__environment/DataFactory.d.ts" },
  { status: "D", file: "types/rdfjs__environment/DatasetFactory.d.ts" },
  { status: "D", file: "types/rdfjs__environment/NamespaceFactory.d.ts" },
  { status: "D", file: "types/rdfjs__environment/TermMapSetFactory.d.ts" },
  { status: "M", file: "types/rdfjs__environment/package.json" },
  { status: "M", file: "types/rdfjs__environment/rdfjs__environment-tests.ts" },
  { status: "R", source: "types/rdfjs__formats-common/.npmignore", file: "types/rdfjs__formats/.npmignore" },
  { status: "R", source: "types/rdfjs__environment/FormatsFactory.d.ts", file: "types/rdfjs__formats/Factory.d.ts" },
  { status: "R", source: "types/rdfjs__formats-common/index.d.ts", file: "types/rdfjs__formats/index.d.ts" },
  { status: "R", source: "types/rdfjs__environment/lib/Formats.d.ts", file: "types/rdfjs__formats/lib/Formats.d.ts" },
  { status: "R", source: "types/rdfjs__formats-common/package.json", file: "types/rdfjs__formats/package.json" },
  { status: "A", file: "types/rdfjs__formats/pretty.d.ts" },
  {
    status: "R",
    source: "types/rdfjs__formats-common/rdfjs__formats-common-tests.ts",
    file: "types/rdfjs__formats/rdfjs__formats-tests.ts",
  },
  { status: "A", file: "types/rdfjs__formats/tsconfig.json" },
  { status: "M", file: "types/rdfjs__serializer-jsonld-ext/index.d.ts" },
  { status: "M", file: "types/rdfjs__serializer-jsonld-ext/package.json" },
  { status: "M", file: "types/rdfjs__serializer-jsonld-ext/rdfjs__serializer-jsonld-ext-tests.ts" },
  { status: "A", file: "types/rdfjs__serializer-turtle/.npmignore" },
  { status: "A", file: "types/rdfjs__serializer-turtle/index.d.ts" },
  { status: "A", file: "types/rdfjs__serializer-turtle/package.json" },
  { status: "A", file: "types/rdfjs__serializer-turtle/rdfjs__serializer-turtle-tests.ts" },
  {
    status: "R",
    source: "types/rdfjs__formats-common/tsconfig.json",
    file: "types/rdfjs__serializer-turtle/tsconfig.json",
  },
];
function getDeletions(diffs: GitDiff[]): PackageId[] {
  const changes = gitChanges(diffs);
  expect(changes).not.toHaveProperty("error");
  const { deletions } = changes as { deletions: PackageId[]; additions: PackageId[] };
  return deletions;
}

testo({
  async ok() {
    expect(await getNotNeededPackages(allPackages, getDeletions(deleteJestDiffs))).toEqual(jestNotNeeded);
  },
  async gitMovesConvertedToAddsAndDeletes() {
    expect(gitChanges(moveRdfJSDiffs)).toEqual({
      additions: [
        { typesDirectoryName: "rdf-ext", version: "*" },
        { typesDirectoryName: "rdfjs__formats", version: "*" },
        { typesDirectoryName: "rdfjs__serializer-turtle", version: "*" },
      ],
      deletions: [
        { typesDirectoryName: "rdf-ext", version: "*" },
        { typesDirectoryName: "rdfjs__environment", version: "*" },
        { typesDirectoryName: "rdfjs__formats-common", version: "*" },
      ],
    });
  },
  async forgotToDeleteFiles() {
    expect(
      await getNotNeededPackages(
        AllPackages.fromTestData({ jest: createTypingsVersionRaw("jest", {}, {}) }, jestNotNeeded),
        getDeletions(deleteJestDiffs),
      ),
    ).toEqual({ errors: ["Please delete all files in jest when adding it to notNeededPackages.json."] });
  },
  async tooManyDeletes() {
    expect(
      await getNotNeededPackages(allPackages, getDeletions([{ status: "D", file: "types/oops/oops.txt" }])),
    ).toEqual([]);
  },
  async deleteInOtherPackage() {
    expect(
      await getNotNeededPackages(
        allPackages,
        getDeletions([...deleteJestDiffs, { status: "D", file: "types/most-recent/extra-tests.ts" }]),
      ),
    ).toEqual(jestNotNeeded);
  },
  async extraneousFile() {
    expect(
      await getNotNeededPackages(
        allPackages,
        getDeletions([...deleteJestDiffs, { status: "A", file: "types/oops/oooooooooooops.txt" }]),
      ),
    ).toEqual(jestNotNeeded);
  },
  async scoped() {
    expect(
      await getNotNeededPackages(
        AllPackages.fromTestData(typesData, [new NotNeededPackage("ember__object", "@ember/object", "1.0.0")]),
        getDeletions([{ status: "D", file: "types/ember__object/index.d.ts" }]),
      ),
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
  async missingSource() {
    return expect(await checkNotNeededPackage(nonexistentReplacementPackage)).toEqual([
      `The entry for @types/jest in notNeededPackages.json has
"libraryName": "nonexistent", but there is no npm package with this name.
Unneeded packages have to be replaced with a package on npm.`,
    ]);
  },
  async missingTypings() {
    return expect(await checkNotNeededPackage(nonexistentTypesPackage)).toEqual([
      "Unexpected error: @types package not found for @types/nonexistent",
    ]);
  },
  async deprecatedSameVersion() {
    return expect(await checkNotNeededPackage(sameVersion)).toEqual([
      `The specified version 50.0.0 of jest must be newer than the version
it is supposed to replace, 50.0.0 of @types/jest.`,
    ]);
  },
  async deprecatedOlderVersion() {
    return expect(await checkNotNeededPackage(olderReplacement)).toEqual([
      `The specified version 4.0.0 of jest must be newer than the version
it is supposed to replace, 50.0.0 of @types/jest.`,
    ]);
  },
  async missingNpmVersion() {
    return expect(await checkNotNeededPackage(nonexistentReplacementVersion)).toEqual([
      "The specified version 999.0.0 of jest is not on npm.",
    ]);
  },
  ok() {
    return checkNotNeededPackage(newerReplacement);
  },
});
