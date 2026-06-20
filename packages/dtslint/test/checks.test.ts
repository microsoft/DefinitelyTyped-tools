/// <reference types="jest" />
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";

describe("checkTsconfig additional coverage", () => {
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

  function config(overrides?: Partial<CompilerOptionsRaw>, fileOverrides?: object) {
    return { compilerOptions: { ...base, ...overrides }, files: ["index.d.ts", "test.ts"], ...fileOverrides };
  }

  describe("mustHave validations", () => {
    it("errors when noEmit is false", () => {
      const errors = checkTsconfig(config({ noEmit: false }));
      expect(errors).toContainEqual(expect.stringContaining("noEmit"));
    });

    it("errors when noEmit is missing", () => {
      const opts = { ...base };
      delete (opts as any).noEmit;
      expect(checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] })).toContainEqual(
        expect.stringContaining("noEmit"),
      );
    });

    it("errors when forceConsistentCasingInFileNames is false", () => {
      const errors = checkTsconfig(config({ forceConsistentCasingInFileNames: false }));
      expect(errors).toContainEqual(expect.stringContaining("forceConsistentCasingInFileNames"));
    });

    it("errors when types is not an empty array", () => {
      const errors = checkTsconfig(config({ types: ["node"] }));
      expect(errors).toContainEqual(expect.stringContaining("types"));
    });
  });

  describe("lib validation", () => {
    it("errors when lib is missing", () => {
      const opts = { ...base };
      delete (opts as any).lib;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('Must specify "lib"'));
    });
  });

  describe("module validation", () => {
    it("errors when module is an invalid value", () => {
      const errors = checkTsconfig(config({ module: "esnext" }));
      expect(errors).toContainEqual(
        expect.stringContaining('When "module" is present, it must be set to "commonjs" or "node16"'),
      );
    });

    it("allows module: commonjs", () => {
      const errors = checkTsconfig(config({ module: "commonjs" }));
      expect(errors).toEqual([]);
    });

    it("allows module: node16", () => {
      const errors = checkTsconfig(config({ module: "node16" }));
      expect(errors).toEqual([]);
    });

    it("allows module: COMMONJS (case insensitive)", () => {
      const errors = checkTsconfig(config({ module: "COMMONJS" }));
      expect(errors).toEqual([]);
    });
  });

  describe("strict mode", () => {
    it("allows strict: true and removes individual strict options", () => {
      const strictOpts: CompilerOptionsRaw = {
        module: "commonjs",
        lib: ["es6"],
        strict: true,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      const errors = checkTsconfig({ compilerOptions: strictOpts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toEqual([]);
    });

    it("errors when strict is false", () => {
      const strictOpts: CompilerOptionsRaw = {
        module: "commonjs",
        lib: ["es6"],
        strict: false,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      const errors = checkTsconfig({ compilerOptions: strictOpts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('When "strict" is present, it must be set to `true`'));
    });

    it("throws when strict is true and noImplicitAny is also set", () => {
      const strictOpts: CompilerOptionsRaw = {
        module: "commonjs",
        lib: ["es6"],
        strict: true,
        noImplicitAny: true,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      expect(() => checkTsconfig({ compilerOptions: strictOpts, files: ["index.d.ts", "test.ts"] })).toThrow(
        TypeError,
      );
    });

    it("throws when strict is true and strictNullChecks is also set", () => {
      const strictOpts: CompilerOptionsRaw = {
        module: "commonjs",
        lib: ["es6"],
        strict: true,
        strictNullChecks: true,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      expect(() => checkTsconfig({ compilerOptions: strictOpts, files: ["index.d.ts", "test.ts"] })).toThrow(
        TypeError,
      );
    });

    it("errors when not strict and missing noImplicitAny", () => {
      const opts = { ...base };
      delete (opts as any).noImplicitAny;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining("noImplicitAny"));
    });

    it("errors when not strict and missing noImplicitThis", () => {
      const opts = { ...base };
      delete (opts as any).noImplicitThis;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining("noImplicitThis"));
    });

    it("errors when not strict and missing strictNullChecks", () => {
      const opts = { ...base };
      delete (opts as any).strictNullChecks;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining("strictNullChecks"));
    });

    it("errors when not strict and missing strictFunctionTypes", () => {
      const opts = { ...base };
      delete (opts as any).strictFunctionTypes;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining("strictFunctionTypes"));
    });
  });

  describe("allowed optional compiler options", () => {
    it("allows target", () => {
      expect(checkTsconfig(config({ target: "es2020" }))).toEqual([]);
    });

    it("allows jsx", () => {
      expect(checkTsconfig(config({ jsx: "react" }))).toEqual([]);
    });

    it("allows jsxFactory", () => {
      expect(checkTsconfig(config({ jsxFactory: "h" }))).toEqual([]);
    });

    it("allows jsxImportSource", () => {
      expect(checkTsconfig(config({ jsxImportSource: "preact" }))).toEqual([]);
    });

    it("allows experimentalDecorators", () => {
      expect(checkTsconfig(config({ experimentalDecorators: true }))).toEqual([]);
    });

    it("allows noUnusedLocals", () => {
      expect(checkTsconfig(config({ noUnusedLocals: true }))).toEqual([]);
    });

    it("allows noUnusedParameters", () => {
      expect(checkTsconfig(config({ noUnusedParameters: true }))).toEqual([]);
    });

    it("allows esModuleInterop", () => {
      expect(checkTsconfig(config({ esModuleInterop: true }))).toEqual([]);
    });

    it("allows allowSyntheticDefaultImports", () => {
      expect(checkTsconfig(config({ allowSyntheticDefaultImports: true }))).toEqual([]);
    });

    it("allows noUncheckedIndexedAccess", () => {
      expect(checkTsconfig(config({ noUncheckedIndexedAccess: true }))).toEqual([]);
    });
  });

  describe("unknown compiler options", () => {
    it("reports multiple unknown options", () => {
      const errors = checkTsconfig(config({ someOption: true, anotherOption: false } as any));
      expect(errors).toContainEqual(expect.stringContaining("someOption"));
      expect(errors).toContainEqual(expect.stringContaining("anotherOption"));
    });
  });

  describe("files validation edge cases", () => {
    it("allows index.d.ts with ./index.d.ts prefix", () => {
      expect(checkTsconfig({ compilerOptions: base, files: ["./index.d.ts", "./test.ts"] })).toEqual([]);
    });

    it("errors when files has only test files but no index.d.ts", () => {
      const errors = checkTsconfig({ compilerOptions: base, files: ["test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('"files" list must include "index.d.ts"'));
    });

    it("returns error for include even if files is present", () => {
      const errors = checkTsconfig({ compilerOptions: base, include: ["**/*.ts"], files: ["index.d.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('Use "files" instead of "include"'));
    });
  });

  describe("valid complete config produces no errors", () => {
    it("passes with a well-formed config", () => {
      expect(checkTsconfig(config())).toEqual([]);
    });
  });
});
