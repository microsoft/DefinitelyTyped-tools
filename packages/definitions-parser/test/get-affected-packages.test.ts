import { getAffectedPackagesWorker } from "../src/get-affected-packages";
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
typesData.jquery["2.0"] = { ...typesData.jquery["1.0"], libraryMajorVersion: 2 };

const notNeeded = [new NotNeededPackage("jest", "jest", "100.0.0")];
const allPackages = AllPackages.from(typesData, notNeeded);

testo({
  updatedPackage() {
    const packageOutput = `/dt/types/jquery`
    const dependentOutput = `/dt/types/jquery
/dt/types/known-test
/dt/types/most-recent`
    const { packageNames, dependents } = getAffectedPackagesWorker(allPackages, packageOutput, dependentOutput, '/dt');
    expect(packageNames).toEqual(new Set(["jquery"]))
    expect(dependents).toEqual([ "known-test", "most-recent", ]);
  },
  deletedPackage() {
    // TODO
    const packageOutput = `/dt/types/WAT`
    const dependentOutput = `/dt/types/WAT
/dt/types/unknown-test`
    const { packageNames, dependents } = getAffectedPackagesWorker(allPackages, packageOutput, dependentOutput, '/dt')
    expect(packageNames).toEqual(new Set([]));
    expect(dependents).toEqual(["unknown-test"]);
  },
  deletedVersion() {
    // TODO
    const packageOutput = ``
    const dependentOutput = ``
    const { packageNames } = getAffectedPackagesWorker(allPackages, packageOutput, dependentOutput, '/dt')
    expect(packageNames).toEqual(new Set());
  },
  olderVersion() {
    // TODO
    const packageOutput = `/dt/types/jquery`
    const dependentOutput = `/dt/types/jquery
/dt/types/has-older-test-dependency
/dt/types/known`
    const { packageNames, dependents } = getAffectedPackagesWorker(allPackages, packageOutput, dependentOutput, '/dt')
    expect(packageNames).toEqual(new Set(["jquery"]))
    expect(dependents).toEqual([ "has-older-test-dependency", "known", ]);
  },
});
