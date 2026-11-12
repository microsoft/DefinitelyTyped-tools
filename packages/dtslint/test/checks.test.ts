/// <reference types="jest" />
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";

describe("checks - additional coverage", () => {
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

  describe("checkTsconfig - mustHave validations", () => {
    it("errors when noEmit is false", () => {
      const errors = checkTsconfig(based({ noEmit: false }));
      expect(errors).toContainEqual(expect.stringContaining("noEmit"));
    });

    it("errors when noEmit is missing", () => {
      const opts = { ...base };
      delete (opts as any).noEmit;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining("noEmit"));
    });

    it("errors when forceConsistentCasingInFileNames is false", () => {
      const errors = checkTsconfig(based({ forceConsistentCasingInFileNames: false }));
      expect(errors).toContainEqual(expect.stringContaining("forceConsistentCasingInFileNames"));
    });

    it("errors when types is not empty array", () => {
      const errors = checkTsconfig(based({ types: ["node"] }));
      expect(errors).toContainEqual(expect.stringContaining("types"));
    });
  });

  describe("checkTsconfig - strict mode", () => {
    it("allows strict: true without individual strict options", () => {
      const compilerOptions = {
        module: "commonjs",
        lib: ["es6"],
        strict: true,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      const errors = checkTsconfig({ compilerOptions, files: ["index.d.ts", "test.ts"] });
      expect(errors).toEqual([]);
    });

    it("errors when strict is false", () => {
      const compilerOptions = {
        module: "commonjs",
        lib: ["es6"],
        strict: false,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      const errors = checkTsconfig({ compilerOptions, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('When "strict" is present, it must be set to `true`.'));
    });

    it("throws when strict is true and noImplicitAny is also set", () => {
      const compilerOptions = {
        module: "commonjs",
        lib: ["es6"],
        strict: true,
        noImplicitAny: true,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      expect(() => checkTsconfig({ compilerOptions, files: ["index.d.ts", "test.ts"] })).toThrow(
        '"noImplicitAny" to not be set when "strict" is `true`',
      );
    });

    it("throws when strict is true and strictNullChecks is also set", () => {
      const compilerOptions = {
        module: "commonjs",
        lib: ["es6"],
        strict: true,
        strictNullChecks: true,
        types: [],
        noEmit: true,
        forceConsistentCasingInFileNames: true,
      };
      expect(() => checkTsconfig({ compilerOptions, files: ["index.d.ts", "test.ts"] })).toThrow(
        '"strictNullChecks" to not be set when "strict" is `true`',
      );
    });

    it("errors when not strict and noImplicitAny is missing", () => {
      const opts = { ...base };
      delete (opts as any).noImplicitAny;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('"noImplicitAny": true'));
    });

    it("errors when not strict and strictFunctionTypes is missing", () => {
      const opts = { ...base };
      delete (opts as any).strictFunctionTypes;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('"strictFunctionTypes": true'));
    });
  });

  describe("checkTsconfig - module values", () => {
    it("errors for module: 'amd'", () => {
      const errors = checkTsconfig(based({ module: "amd" }));
      expect(errors).toContainEqual(
        expect.stringContaining('When "module" is present, it must be set to "commonjs" or "node16"'),
      );
    });

    it("errors for module: 'esnext'", () => {
      const errors = checkTsconfig(based({ module: "esnext" }));
      expect(errors).toContainEqual(
        expect.stringContaining('When "module" is present, it must be set to "commonjs" or "node16"'),
      );
    });

    it("allows module: 'commonjs' (case-insensitive)", () => {
      const errors = checkTsconfig(based({ module: "CommonJS" }));
      expect(errors).toEqual([]);
    });

    it("allows module: 'Node16' (case-insensitive)", () => {
      const errors = checkTsconfig(based({ module: "Node16" }));
      expect(errors).toEqual([]);
    });
  });

  describe("checkTsconfig - lib", () => {
    it("errors when lib is missing", () => {
      const opts = { ...base };
      delete (opts as any).lib;
      const errors = checkTsconfig({ compilerOptions: opts, files: ["index.d.ts", "test.ts"] });
      expect(errors).toContainEqual(expect.stringContaining('Must specify "lib"'));
    });
  });

  describe("checkTsconfig - types with entries", () => {
    it("errors when types array has entries", () => {
      const errors = checkTsconfig(based({ types: ["node", "jest"] }));
      expect(errors).toContainEqual(expect.stringContaining("reference types"));
    });
  });

  describe("checkTsconfig - allowed optional options", () => {
    it("allows target", () => {
      expect(checkTsconfig(based({ target: "es2020" }))).toEqual([]);
    });

    it("allows jsx", () => {
      expect(checkTsconfig(based({ jsx: "react" }))).toEqual([]);
    });

    it("allows jsxFactory", () => {
      expect(checkTsconfig(based({ jsxFactory: "h" }))).toEqual([]);
    });

    it("allows jsxImportSource", () => {
      expect(checkTsconfig(based({ jsxImportSource: "preact" }))).toEqual([]);
    });

    it("allows experimentalDecorators", () => {
      expect(checkTsconfig(based({ experimentalDecorators: true }))).toEqual([]);
    });

    it("allows noUnusedLocals", () => {
      expect(checkTsconfig(based({ noUnusedLocals: true }))).toEqual([]);
    });

    it("allows noUnusedParameters", () => {
      expect(checkTsconfig(based({ noUnusedParameters: true }))).toEqual([]);
    });

    it("allows esModuleInterop", () => {
      expect(checkTsconfig(based({ esModuleInterop: true }))).toEqual([]);
    });

    it("allows allowSyntheticDefaultImports", () => {
      expect(checkTsconfig(based({ allowSyntheticDefaultImports: true }))).toEqual([]);
    });

    it("allows noUncheckedIndexedAccess", () => {
      expect(checkTsconfig(based({ noUncheckedIndexedAccess: true }))).toEqual([]);
    });
  });
});
