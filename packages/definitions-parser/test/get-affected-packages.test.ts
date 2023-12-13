import { getAffectedPackagesWorker } from "../src/get-affected-packages";
import { NotNeededPackage, AllPackages } from "../src/packages";
import { testo, createTypingsVersionRaw } from "./utils";

const typesData = {
  "has-older-test-dependency": createTypingsVersionRaw("has-older-test-dependency", {}, { "@types/jquery": "1.0.0" }),
  jquery: createTypingsVersionRaw("jquery", {}, {}),
  known: createTypingsVersionRaw("known", { "@types/jquery": "1.0.0" }, {}),
  "known-test": createTypingsVersionRaw("known-test", {}, { "@types/jquery": "*" }),
  "most-recent": createTypingsVersionRaw("most-recent", { "@types/jquery": "*" }, {}),
  unknown: createTypingsVersionRaw("unknown", { "@types/COMPLETELY-UNKNOWN": "1.0.0" }, {}),
  "unknown-test": createTypingsVersionRaw("unknown-test", {}, { "@types/WAT": "*" }),
};
typesData.jquery["2.0"] = {
  ...typesData.jquery["1.0"],
  header: { ...typesData.jquery["1.0"].header, libraryMajorVersion: 2 },
};

const notNeeded = [new NotNeededPackage("jest", "jest", "100.0.0")];
const allPackages = AllPackages.fromTestData(typesData, notNeeded);

testo({
  async updatedPackage() {
    const packageOutput = `/dt/types/jquery`;
    const dependentOutput = `/dt/types/jquery
/dt/types/known-test
/dt/types/most-recent`;
    const { packageNames, dependents } = await getAffectedPackagesWorker(
      allPackages,
      packageOutput,
      [],
      [dependentOutput],
      "/dt",
    );
    expect(packageNames).toEqual(new Set(["jquery"]));
    expect(dependents).toEqual(new Set(["known-test", "most-recent"]));
  },
  async deletedPackage() {
    const packageOutput = ``;
    const dependentOutput = `/dt/types/unknown-test`;
    const { packageNames, dependents } = await getAffectedPackagesWorker(
      allPackages,
      packageOutput,
      [],
      [dependentOutput],
      "/dt",
    );
    expect(packageNames).toEqual(new Set([]));
    expect(dependents).toEqual(new Set(["unknown-test"]));
  },
  async deletedVersion() {
    const packageOutput = `/dt/types/jquery`;
    const dependentOutput = [
      `/dt/types/jquery
/dt/types/known-test
/dt/types/most-recent`,
      `/dt/types/has-older-test-dependency
/dt/types/known`,
    ];
    const { packageNames } = await getAffectedPackagesWorker(allPackages, packageOutput, [], dependentOutput, "/dt");
    expect(packageNames).toEqual(new Set(["jquery"]));
  },
  async newPackage() {
    const packageOutput = ``;
    const dependentOutput = ``;
    const { packageNames, dependents } = await getAffectedPackagesWorker(
      allPackages,
      packageOutput,
      ["mistake"],
      [dependentOutput],
      "/dt",
    );
    expect(packageNames).toEqual(new Set(["mistake"]));
    expect(dependents).toEqual(new Set([]));
  },
  async olderVersion() {
    const packageOutput = `/dt/types/jquery`;
    const dependentOutput = `/dt/types/jquery
/dt/types/has-older-test-dependency
/dt/types/known`;
    const { packageNames, dependents } = await getAffectedPackagesWorker(
      allPackages,
      packageOutput,
      [],
      [dependentOutput],
      "/dt",
    );
    expect(packageNames).toEqual(new Set(["jquery"]));
    expect(dependents).toEqual(new Set(["has-older-test-dependency", "known"]));
  },
});
