import { scopeName } from "../src/lib/settings";
import { TypingsVersionsRaw, License, getMangledNameForScopedPackage } from "../src/packages";

export function testo(o: { [s: string]: () => void }) {
  for (const k of Object.keys(o)) {
    test(k, o[k], 100_000);
  }
}

export function createTypingsVersionRaw(
  libraryName: string,
  dependencies: { readonly [name: string]: string },
  devDependencies: { readonly [name: string]: string }
): TypingsVersionsRaw {
  return {
    "1.0": {
      header: {
        name: `@${scopeName}/${getMangledNameForScopedPackage(libraryName)}`,
        libraryMajorVersion: 1,
        libraryMinorVersion: 0,
        contributors: [{ name: "Bender", url: "futurama.com", githubUsername: "bender" }],
        typeScriptVersion: "2.3",
        nonNpm: false,
        projects: ["zombo.com"],
      },
      files: ["index.d.ts"],
      typesVersions: [],
      license: License.MIT,
      packageJsonDependencies: dependencies,
      packageJsonDevDependencies: devDependencies,
      contentHash: "11111111111111",
      globals: [],
    },
  };
}
