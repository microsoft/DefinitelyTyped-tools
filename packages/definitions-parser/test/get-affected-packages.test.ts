import { allDependencies, getAffectedPackages } from "../src/get-affected-packages";
import { NotNeededPackage, TypesDataFile, AllPackages } from "../src/packages";
import { testo, createTypingsVersionRaw } from "./utils";

const typesData: TypesDataFile = {
  "has-older-test-dependency": createTypingsVersionRaw("has-older-test-dependency", {}, ["jquery"], {
    jquery: { major: 1 }
  }),
  jquery: createTypingsVersionRaw("jquery", {}, [], {}),
  known: createTypingsVersionRaw("known", { jquery: { major: 1 } }, [], {}),
  "known-test": createTypingsVersionRaw("known-test", {}, ["jquery"], {}),
  "most-recent": createTypingsVersionRaw("most-recent", { jquery: "*" }, [], {}),
  unknown: createTypingsVersionRaw("unknown", { "COMPLETELY-UNKNOWN": { major: 1 } }, [], {}),
  "unknown-test": createTypingsVersionRaw("unknown-test", {}, ["WAT"], {})
};
typesData.jquery["2.0"] = { ...typesData.jquery["1.0"], libraryMajorVersion: 2 };

const notNeeded = [
  new NotNeededPackage({
    typingsPackageName: "jest",
    libraryName: "jest",
    asOfVersion: "100.0.0",
    sourceRepoURL: "jest.com"
  })
];
const allPackages = AllPackages.from(typesData, notNeeded);

testo({
  updatedPackage() {
    const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [
      { name: "jquery", version: { major: 2 } }
    ]);
    expect(changedPackages.map(({ id }) => id)).toEqual([{ name: "jquery", version: { major: 2, minor: 0 } }]);
    expect((changedPackages[0] as any).data).toEqual(typesData.jquery["2.0"]);
    expect(dependentPackages.map(({ id }) => id)).toEqual([
      { name: "known-test", version: { major: 1, minor: 0 } },
      { name: "most-recent", version: { major: 1, minor: 0 } }
    ]);
  },
  deletedPackage() {
    const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [{ name: "WAT", version: "*" }]);
    expect(changedPackages.map(({ id }) => id)).toEqual([]);
    expect(dependentPackages.map(({ id }) => id)).toEqual([{ name: "unknown-test", version: { major: 1, minor: 0 } }]);
  },
  olderVersion() {
    const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [
      { name: "jquery", version: { major: 1 } }
    ]);
    expect(changedPackages.map(({ id }) => id)).toEqual([{ name: "jquery", version: { major: 1, minor: 0 } }]);
    expect(dependentPackages.map(({ id }) => id)).toEqual([
      { name: "has-older-test-dependency", version: { major: 1, minor: 0 } },
      { name: "known", version: { major: 1, minor: 0 } }
    ]);
  },
  allDependencies() {
    const typesData = {
      dependency: createTypingsVersionRaw(
        "dependency",
        { "dependency-of-dependency": "*" },
        ["test-dependency-of-dependency"],
        {}
      ),
      "dependency-of-dependency": createTypingsVersionRaw("dependency-of-dependency", {}, [], {}),
      "dependency-of-test-dependency": createTypingsVersionRaw("dependency-of-test-dependency", {}, [], {}),
      self: createTypingsVersionRaw("self", { dependency: "*" }, ["test-dependency"], {}),
      "test-dependency": createTypingsVersionRaw(
        "test-dependency",
        { "dependency-of-test-dependency": "*" },
        ["test-dependency-of-test-dependency"],
        {}
      ),
      "test-dependency-of-dependency": createTypingsVersionRaw("test-dependency-of-dependency", {}, [], {}),
      "test-dependency-of-test-dependency": createTypingsVersionRaw("test-dependency-of-test-dependency", {}, [], {})
    };
    const allPackages = AllPackages.from(typesData, []);
    const self = allPackages.getTypingsData({ name: "self", version: "*" });
    expect(allDependencies(allPackages, [self]).map(({ id }) => id)).toEqual([
      { name: "dependency", version: { major: 1, minor: 0 } },
      { name: "dependency-of-dependency", version: { major: 1, minor: 0 } },
      { name: "dependency-of-test-dependency", version: { major: 1, minor: 0 } },
      { name: "self", version: { major: 1, minor: 0 } },
      { name: "test-dependency", version: { major: 1, minor: 0 } }
    ]);
  }
});
