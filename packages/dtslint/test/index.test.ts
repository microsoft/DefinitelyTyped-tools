/// <reference types="jest" />
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";
import { assertPackageIsNotDeprecated } from "../src/index";

describe("dtslint", () => {
  const base: CompilerOptionsRaw = {
    module: "commonjs",
    lib: ["es6"],
    noImplicitAny: true,
    noImplicitThis: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    types: [],
    noEmit: true,
    forceConsistentCasingInFileNames: true,
  };
  function based(extra: object) {
    return { compilerOptions: { ...base, ...extra }, files: ["index.d.ts", "base.test.ts"] };
  }
  describe("checks", () => {
    describe("checkTsconfig", () => {
      it("disallows unknown compiler options", () => {
        expect(checkTsconfig(based({ completelyInvented: true }))).toEqual([
          "Unexpected compiler option completelyInvented",
        ]);
      });
      it("allows exactOptionalPropertyTypes: true", () => {
        expect(checkTsconfig(based({ exactOptionalPropertyTypes: true }))).toEqual([]);
      });
      it("allows module: node16", () => {
        expect(checkTsconfig(based({ module: "node16" }))).toEqual([]);
      });
      it("allows `paths`", () => {
        expect(checkTsconfig(based({ paths: { boom: ["../boom/index.d.ts"] } }))).toEqual([]);
      });
      it("disallows missing `module`", () => {
        const compilerOptions = { ...base };
        delete compilerOptions.module;
        expect(checkTsconfig({ compilerOptions, files: ["index.d.ts", "base.test.ts"] })).toEqual([
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.',
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        expect(checkTsconfig(based({ exactOptionalPropertyTypes: false }))).toEqual([
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.',
        ]);
      });
      it("allows paths: self-reference", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["./index.d.ts"] } }))).toEqual([]);
      });
      it("allows paths: matching ../reference/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/index.d.ts"] } }))).toEqual([]);
        expect(
          checkTsconfig(
            based({ paths: { "react-native": ["../react-native/index.d.ts"], react: ["../react/v16/index.d.ts"] } }),
          ),
        ).toEqual([]);
      });
      it("forbids paths: mapping to multiple things", () => {
        expect(
          checkTsconfig(based({ paths: { "react-native": ["./index.d.ts", "../react-native/v0.68/index.d.ts"] } })),
        ).toEqual([`"paths" must map each module specifier to only one file.`]);
      });
      it("allows paths: matching ../reference/version/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { react: ["../react/v16/index.d.ts"] } }))).toEqual([]);
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.69/index.d.ts"] } }))).toEqual([]);
        expect(checkTsconfig(based({ paths: { "react-native": ["../../react-native/v0.69/index.d.ts"] } }))).toEqual(
          [],
        );
      });
      it("forbids paths: mapping to self-contained file", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["./other.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../NOT/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../cocoa/index.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/other.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/deep/index.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.68/deep/index.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.70/other.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("Forbids exclude", () => {
        expect(checkTsconfig({ compilerOptions: base, exclude: ["**/node_modules"] })).toEqual([
          `Use "files" instead of "exclude".`,
        ]);
      });
      it("Forbids include", () => {
        expect(checkTsconfig({ compilerOptions: base, include: ["**/node_modules"] })).toEqual([
          `Use "files" instead of "include".`,
        ]);
      });
      it("Requires files", () => {
        expect(checkTsconfig({ compilerOptions: base })).toEqual([`Must specify "files".`]);
      });
      it("Requires files to contain index.d.ts", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["package-name.d.ts", "package-name.test.ts"] })).toEqual([
          `"files" list must include "index.d.ts".`,
        ]);
      });
      // it("Requires files to contain .[mc]ts file", () => {
      //   expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts"] })).toEqual([
      //     `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
      //   ]);
      // });
      it("Allows files to contain index.d.ts plus a .tsx", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.tsx"] })).toEqual([]);
      });
      it("Allows files to contain index.d.ts plus a .mts", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.mts"] })).toEqual([]);
      });
      it("Allows files to contain index.d.ts plus a .cts", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.cts"] })).toEqual([]);
      });
      it("Allows files to contain ./index.d.ts plus a ./.tsx", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["./index.d.ts", "./tests.tsx"] })).toEqual([]);
      });
      it("Issues both errors on empty files list", () => {
        expect(checkTsconfig({ compilerOptions: base, files: [] })).toEqual([
          `"files" list must include "index.d.ts".`,
          // `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
        ]);
      });
    });
    describe("assertPackageIsNotDeprecated", () => {
      it("disallows packages that are in notNeededPackages.json", () => {
        expect(() => assertPackageIsNotDeprecated("foo", '{ "packages": { "foo": { } } }')).toThrow(
          "notNeededPackages.json has an entry for foo.",
        );
      });
      it("allows packages that are not in notNeededPackages.json", () => {
        expect(assertPackageIsNotDeprecated("foo", '{ "packages": { "bar": { } } }')).toBeUndefined();
      });
    });
  });
});
