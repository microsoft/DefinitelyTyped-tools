/// <reference types="jest" />
import { testNoLintDisables, normalizePath, isTypesVersionPath, startsWithDirectory, range } from "../src/lint";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

describe("lint", () => {
  describe("normalizePath", () => {
    it("replaces backslashes with forward slashes", () => {
      expect(normalizePath("C:\\Users\\test\\file.ts")).toContain("/");
      expect(normalizePath("C:\\Users\\test\\file.ts")).not.toContain("\\");
    });

    it("uppercases drive letters", () => {
      const result = normalizePath("c:/Users/test/file.ts");
      expect(result).toMatch(/^C:/);
    });

    it("keeps already-uppercased drive letters", () => {
      const result = normalizePath("C:/Users/test/file.ts");
      expect(result).toMatch(/^C:/);
    });

    it("handles Unix-style paths", () => {
      const result = normalizePath("/home/user/file.ts");
      expect(result).toBe("/home/user/file.ts");
    });
  });

  describe("isTypesVersionPath", () => {
    it("returns truthy for ts-versioned subdirectory", () => {
      expect(isTypesVersionPath("/types/react/ts3.6/index.d.ts", "/types/react")).toBeTruthy();
    });

    it("returns truthy for ts5.0 subdirectory", () => {
      expect(isTypesVersionPath("/types/node/ts5.0/index.d.ts", "/types/node")).toBeTruthy();
    });

    it("returns falsy for non-ts-versioned path", () => {
      expect(isTypesVersionPath("/types/react/index.d.ts", "/types/react")).toBeFalsy();
    });

    it("returns falsy for file not under dirPath", () => {
      expect(isTypesVersionPath("/types/other/ts3.6/index.d.ts", "/types/react")).toBeFalsy();
    });

    it("returns falsy for non-matching version pattern", () => {
      expect(isTypesVersionPath("/types/react/v16/index.d.ts", "/types/react")).toBeFalsy();
    });
  });

  describe("startsWithDirectory", () => {
    it("returns true when file is in directory", () => {
      expect(startsWithDirectory("/types/react/index.d.ts", "/types/react")).toBe(true);
    });

    it("returns false when file is not in directory", () => {
      expect(startsWithDirectory("/types/other/index.d.ts", "/types/react")).toBe(false);
    });

    it("returns false for partial directory name match", () => {
      expect(startsWithDirectory("/types/react-native/index.d.ts", "/types/react")).toBe(false);
    });

    it("handles trailing slash in dirPath", () => {
      expect(startsWithDirectory("/types/react/index.d.ts", "/types/react/")).toBe(true);
    });

    it("handles Windows-style paths", () => {
      expect(startsWithDirectory("C:\\types\\react\\index.d.ts", "C:\\types\\react")).toBe(true);
    });
  });

  describe("testNoLintDisables", () => {
    it("returns undefined for text without eslint-disable", () => {
      expect(testNoLintDisables("const x = 1;\nconst y = 2;")).toBeUndefined();
    });

    it("allows eslint-disable-line", () => {
      expect(testNoLintDisables("const x = 1; // eslint-disable-line")).toBeUndefined();
    });

    it("allows eslint-disable-next-line", () => {
      expect(testNoLintDisables("// eslint-disable-next-line\nconst x = 1;")).toBeUndefined();
    });

    it("allows eslint-disable with specific rule (space then rulename)", () => {
      expect(testNoLintDisables("// eslint-disable no-console")).toBeUndefined();
    });

    it("forbids bare eslint-disable (end of string)", () => {
      const result = testNoLintDisables("// eslint-disable");
      expect(result).toBeDefined();
      expect(result!.message).toContain("forbidden");
    });

    it("forbids eslint-disable with newline immediately after", () => {
      const result = testNoLintDisables("// eslint-disable\nconst x = 1;");
      expect(result).toBeDefined();
      expect(result!.message).toContain("forbidden");
    });

    it("forbids eslint-disable followed by space and star (wildcard)", () => {
      const result = testNoLintDisables("/* eslint-disable */");
      expect(result).toBeDefined();
      expect(result!.message).toContain("forbidden");
    });

    it("reports correct position for eslint-disable", () => {
      const text = "const x = 1;\n/* eslint-disable */";
      const result = testNoLintDisables(text);
      expect(result).toBeDefined();
      expect(result!.pos).toBe(text.indexOf("eslint-disable"));
    });

    it("handles multiple eslint-disable occurrences, first allowed, second forbidden", () => {
      const text = "// eslint-disable-line\n/* eslint-disable */";
      const result = testNoLintDisables(text);
      expect(result).toBeDefined();
      expect(result!.pos).toBe(text.lastIndexOf("eslint-disable"));
    });
  });

  describe("range", () => {
    it("returns ['local'] when both min and max are 'local'", () => {
      expect(range("local", "local")).toEqual(["local"]);
    });

    it("returns [latest] when both min and max are latest", () => {
      expect(range(TypeScriptVersion.latest, TypeScriptVersion.latest)).toEqual([TypeScriptVersion.latest]);
    });

    it("returns supported versions from min to max inclusive", () => {
      const supported = TypeScriptVersion.supported;
      if (supported.length >= 2) {
        const min = supported[0];
        const max = supported[1];
        const result = range(min, max);
        expect(result).toContain(min);
        expect(result).toContain(max);
        expect(result.length).toBe(2);
      }
    });

    it("returns versions from min through latest when max is latest", () => {
      const supported = TypeScriptVersion.supported;
      const min = supported[0];
      const result = range(min, TypeScriptVersion.latest);
      expect(result[0]).toBe(min);
      expect(result[result.length - 1]).toBe(TypeScriptVersion.latest);
      // Should include all supported versions plus latest
      expect(result.length).toBe(supported.length + 1);
    });

    it("returns single element when min equals max in supported", () => {
      const v = TypeScriptVersion.supported[0];
      const result = range(v, v);
      expect(result).toEqual([v]);
    });
  });
});
