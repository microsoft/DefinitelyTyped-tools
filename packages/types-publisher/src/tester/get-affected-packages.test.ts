import { testo } from "../util/util";
import { AllPackages, License, NotNeededPackage, TypesDataFile, TypingsVersionsRaw, PackageId } from "../lib/packages";
import getAffectedPackages from "./get-affected-packages";

function createTypingsVersionRaw(
    name: string, dependencies: PackageId[], testDependencies: string[]
): TypingsVersionsRaw {
    return {
        "1": {
            libraryName: name,
            typingsPackageName: name,
            dependencies,
            testDependencies,
            files: ["index.d.ts"],
            libraryMajorVersion: 1,
            libraryMinorVersion: 0,
            pathMappings: [],
            contributors: [{ name: "Bender", url: "futurama.com", githubUsername: "bender" },],
            minTsVersion: "2.3",
            typesVersions: [],
            license: License.MIT,
            packageJsonDependencies: [],
            contentHash: "11111111111111",
            projectName: "zombo.com",
            globals: [],
            declaredModules: [],
        },
    }
}
const typesData: TypesDataFile = {
    jquery: createTypingsVersionRaw("jquery", [], []),
    known: createTypingsVersionRaw("known", [{ name: "jquery", majorVersion: 1 }], []),
    "known-test": createTypingsVersionRaw("known-test", [], ["jquery"]),
    "most-recent": createTypingsVersionRaw("most-recent", [{ name: "jquery", majorVersion: "*" }], []),
    unknown: createTypingsVersionRaw("unknown", [{ name: "COMPLETELY-UNKNOWN", majorVersion: 1 }], []),
    "unknown-test": createTypingsVersionRaw("unknown-test", [], ["WAT"]),
};

const notNeeded = [
    new NotNeededPackage({ typingsPackageName: "jest", libraryName: "jest", asOfVersion: "100.0.0", sourceRepoURL: "jest.com" })
];
const allPackages = AllPackages.from(typesData, notNeeded);

testo({
    updatedPackage() {
        const affected = getAffectedPackages(allPackages, [{ name: "jquery", majorVersion: 1 }]);
        expect(affected.changedPackages.length).toEqual(1);
        expect((affected.changedPackages[0] as any).data).toEqual(typesData.jquery[1]);
        expect(affected.dependentPackages.length).toEqual(3);
    },
    deletedPackage() {
        const affected = getAffectedPackages(allPackages, [{ name: "WAT", majorVersion: "*" }]);
        expect(affected.changedPackages.length).toEqual(0);
        expect(affected.dependentPackages.length).toEqual(1);
    }
})
