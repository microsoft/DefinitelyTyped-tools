import { getAffectedPackages } from "../src/get-affected-packages";
import { NotNeededPackage, TypesDataFile, AllPackages } from "../src/packages";
import { testo, createTypingsVersionRaw } from "./utils";

const typesData: TypesDataFile = {
  "has-older-test-dependency": createTypingsVersionRaw("has-older-test-dependency", {}, { "@types/jquery": "1.0.0" }),
  jquery: createTypingsVersionRaw("jquery", {}, {}),
  known: createTypingsVersionRaw("known", { "@types/jquery": "1.0.0" }, {}),
  "known-test": createTypingsVersionRaw("known-test", {}, { "@types/jquery": "*" }),
  "most-recent": createTypingsVersionRaw("most-recent", { "@types/jquery": "*" }, {}),
  unknown: createTypingsVersionRaw("unknown", { "@types/COMPLETELY-UNKNOWN": "1.0.0" }, {}),
  "unknown-test": createTypingsVersionRaw("unknown-test", {}, { "@types/WAT": "*" }),
};
typesData.jquery["2.0"] = { ...typesData.jquery["1.0"], header: { ...typesData.jquery["1.0"].header, libraryMajorVersion: 2 } };

const notNeeded = [new NotNeededPackage("jest", "jest", "100.0.0")];
const allPackages = AllPackages.from(typesData, notNeeded);

testo({
  updatedPackage() {
    const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [
      { name: "jquery", version: { major: 2 } },
    ]);
    expect(changedPackages.map(({ id }) => id)).toEqual([{ name: "jquery", version: { major: 2, minor: 0 } }]);
    expect((changedPackages[0] as any).data).toEqual(typesData.jquery["2.0"]);
    expect(dependentPackages.map(({ id }) => id)).toEqual([
      { name: "known-test", version: { major: 1, minor: 0 } },
      { name: "most-recent", version: { major: 1, minor: 0 } },
    ]);
  },
  deletedPackage() {
    const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [{ name: "WAT", version: "*" }]);
    expect(changedPackages.map(({ id }) => id)).toEqual([]);
    expect(dependentPackages.map(({ id }) => id)).toEqual([{ name: "unknown-test", version: { major: 1, minor: 0 } }]);
  },
  deletedVersion() {
    const { changedPackages } = getAffectedPackages(allPackages, [{ name: "jquery", version: { major: 0 } }]);
    expect(changedPackages).toEqual([]);
  },
  olderVersion() {
    debugger;
    const { changedPackages, dependentPackages } = getAffectedPackages(allPackages, [
      { name: "jquery", version: { major: 1 } },
    ]);
    expect(changedPackages.map(({ id }) => id)).toEqual([{ name: "jquery", version: { major: 1, minor: 0 } }]);
    expect(dependentPackages.map(({ id }) => id)).toEqual([
      { name: "has-older-test-dependency", version: { major: 1, minor: 0 } },
      { name: "known", version: { major: 1, minor: 0 } },
    ]);
  },
});
