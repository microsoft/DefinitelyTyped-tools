import { License } from "@definitelytyped/header-parser";
import { TypingsVersionsRaw, getMangledNameForScopedPackage } from "../src/packages";
import { atTypesSlash } from "@definitelytyped/utils";

export function testo(o: { [s: string]: () => void }) {
  for (const k of Object.keys(o)) {
    test(k, o[k], 100_000);
  }
}

export function createTypingsVersionRaw(
  libraryName: string,
  dependencies: { readonly [name: string]: string },
  devDependencies: { readonly [name: string]: string },
): TypingsVersionsRaw {
  return {
    "1.0": {
      header: {
        name: `${atTypesSlash}${getMangledNameForScopedPackage(libraryName)}`,
        libraryMajorVersion: 1,
        libraryMinorVersion: 0,
        owners: [{ name: "Bender", url: "futurama.com" }],
        minimumTypeScriptVersion: "2.3",
        nonNpm: false,
        projects: ["zombo.com"],
      },
      typesVersions: [],
      license: License.MIT,
      dependencies,
      devDependencies,
      olderVersionDirectories: [],
    },
  };
}
