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
  describe("checks", () => {
    describe("checkTsconfig", () => {
      it("disallows unknown compiler options", () => {
        expect(checkTsconfig("test", { ...base, completelyInvented: true })).toEqual([
          "Unexpected compiler option completelyInvented",
        ]);
      });
      it("allows exactOptionalPropertyTypes: true", () => {
        expect(checkTsconfig("test", { ...base, exactOptionalPropertyTypes: true })).toEqual([]);
      });
      it("allows module: node16", () => {
        expect(checkTsconfig("test", { ...base, module: "node16" })).toEqual([]);
      });
      it("allows `paths`", () => {
        expect(checkTsconfig("test", { ...base, paths: { boom: ["../boom/index.d.ts"] } })).toEqual([]);
      });
      it("disallows missing `module`", () => {
        const options = { ...base };
        delete options.module;
        expect(checkTsconfig("test", options)).toEqual([
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.',
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        expect(checkTsconfig("test", { ...base, exactOptionalPropertyTypes: false })).toEqual([
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.',
        ]);
      });
      it("allows paths: self-reference", () => {
        expect(checkTsconfig("react-native", { ...base, paths: { "react-native": ["./index.d.ts"] } })).toEqual([]);
      });
      it("allows paths: matching ../reference/index.d.ts", () => {
        expect(
          checkTsconfig("reactive-dep", { ...base, paths: { "react-native": ["../react-native/index.d.ts"] } }),
        ).toEqual([]);
        expect(
          checkTsconfig("reactive-dep", {
            ...base,
            paths: { "react-native": ["../react-native/index.d.ts"], react: ["../react/v16/index.d.ts"] },
          }),
        ).toEqual([]);
      });
      it("forbids paths: mapping to multiple things", () => {
        expect(
          checkTsconfig("reactive-dep", {
            ...base,
            paths: { "react-native": ["./index.d.ts", "../react-native/v0.68/index.d.ts"] },
          }),
        ).toEqual([`reactive-dep/tsconfig.json: "paths" must map each module specifier to only one file.`]);
      });
      it("allows paths: matching ../reference/version/index.d.ts", () => {
        expect(checkTsconfig("reactive-dep", { ...base, paths: { react: ["../react/v16/index.d.ts"] } })).toEqual([]);
        expect(
          checkTsconfig("reactive-dep", { ...base, paths: { "react-native": ["../react-native/v0.69/index.d.ts"] } }),
        ).toEqual([]);
        expect(
          checkTsconfig("reactive-dep/v1", {
            ...base,
            paths: { "react-native": ["../../react-native/v0.69/index.d.ts"] },
          }),
        ).toEqual([]);
      });
      it("forbids paths: mapping to self-contained file", () => {
        expect(checkTsconfig("rrrr", { ...base, paths: { "react-native": ["./other.d.ts"] } })).toEqual([
          `rrrr/tsconfig.json: "paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../NOT/index.d.ts", () => {
        expect(checkTsconfig("rrrr", { ...base, paths: { "react-native": ["../cocoa/index.d.ts"] } })).toEqual([
          `rrrr/tsconfig.json: "paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT.d.ts", () => {
        expect(checkTsconfig("rrrr", { ...base, paths: { "react-native": ["../react-native/other.d.ts"] } })).toEqual([
          `rrrr/tsconfig.json: "paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT/index.d.ts", () => {
        expect(
          checkTsconfig("rrrr", { ...base, paths: { "react-native": ["../react-native/deep/index.d.ts"] } }),
        ).toEqual([`rrrr/tsconfig.json: "paths" must map 'react-native' to react-native's index.d.ts.`]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT/index.d.ts", () => {
        expect(
          checkTsconfig("rrrr", { ...base, paths: { "react-native": ["../react-native/v0.68/deep/index.d.ts"] } }),
        ).toEqual([`rrrr/tsconfig.json: "paths" must map 'react-native' to react-native's index.d.ts.`]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT.d.ts", () => {
        expect(
          checkTsconfig("rrrr", { ...base, paths: { "react-native": ["../react-native/v0.70/other.d.ts"] } }),
        ).toEqual([`rrrr/tsconfig.json: "paths" must map 'react-native' to react-native's index.d.ts.`]);
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
