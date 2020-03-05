import { AllPackages, NotNeededPackage, TypesDataFile } from "@definitelytyped/definitions-parser";
import { createTypingsVersionRaw, testo } from "../utils";

import { getAffectedPackages } from "../../src/tester/get-affected-packages";
const typesData: TypesDataFile = {
  jquery: createTypingsVersionRaw("jquery", [], []),
  known: createTypingsVersionRaw("known", [{ name: "jquery", version: { major: 1 } }], []),
  "known-test": createTypingsVersionRaw("known-test", [], ["jquery"]),
  "most-recent": createTypingsVersionRaw("most-recent", [{ name: "jquery", version: "*" }], []),
  unknown: createTypingsVersionRaw("unknown", [{ name: "COMPLETELY-UNKNOWN", version: { major: 1 } }], []),
  "unknown-test": createTypingsVersionRaw("unknown-test", [], ["WAT"])
};

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
    const affected = getAffectedPackages(allPackages, [{ name: "jquery", version: { major: 1 } }]);
    expect(affected.changedPackages.length).toEqual(1);
    expect((affected.changedPackages[0] as any).data).toEqual(typesData.jquery["1.0.0"]);
    expect(affected.dependentPackages.length).toEqual(3);
  },
  deletedPackage() {
    const affected = getAffectedPackages(allPackages, [{ name: "WAT", version: "*" }]);
    expect(affected.changedPackages.length).toEqual(0);
    expect(affected.dependentPackages.length).toEqual(1);
  }
});
