import { TypingsVersionsRaw, License } from "../src/packages";

export function testo(o: { [s: string]: () => void }) {
  for (const k of Object.keys(o)) {
    test(k, o[k], 100_000);
  }
}

export function createTypingsVersionRaw(
  name: string,
  dependencies: { readonly [name: string]: string },
  devDependencies: { readonly [name: string]: string }
): TypingsVersionsRaw {
  return {
    "1.0": {
      libraryName: name,
      typingsPackageName: name,
      files: ["index.d.ts"],
      libraryMajorVersion: 1,
      libraryMinorVersion: 0,
      contributors: [{ name: "Bender", url: "futurama.com", githubUsername: "bender" }],
      minTsVersion: "2.3",
      typesVersions: [],
      license: License.MIT,
      packageJsonDependencies: dependencies,
      packageJsonDevDependencies: devDependencies,
      contentHash: "11111111111111",
      projectName: "zombo.com",
      globals: [],
    },
  };
}
