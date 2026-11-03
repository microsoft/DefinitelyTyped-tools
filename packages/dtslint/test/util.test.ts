/// <reference types="jest" />
import { packageNameFromPath, packageDirectoryNameWithVersionFromPath, getCompilerOptions } from "../src/util";
import fs from "fs";
import path from "path";

describe("util", () => {
  describe("packageNameFromPath", () => {
    it("returns basename for regular package path", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/jquery")).toBe("jquery");
    });

    it("returns basename for Windows-style path", () => {
      expect(packageNameFromPath("C:\\DefinitelyTyped\\types\\lodash")).toBe("lodash");
    });

    it("returns parent name for versioned directory (v2)", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/react/v16")).toBe("react");
    });

    it("returns parent name for versioned directory with minor (v0.5)", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/express/v0.5")).toBe("express");
    });

    it("returns parent name for ts-versioned directory (ts3.6)", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/node/ts3.6")).toBe("node");
    });

    it("returns parent name for ts-versioned directory (ts5.0)", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/node/ts5.0")).toBe("node");
    });

    it("returns basename when it does not match version pattern", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/some-package")).toBe("some-package");
    });

    it("returns basename for scoped-like package names", () => {
      expect(packageNameFromPath("/home/user/DefinitelyTyped/types/foo__bar")).toBe("foo__bar");
    });
  });

  describe("packageDirectoryNameWithVersionFromPath", () => {
    it("returns just package name for non-versioned path", () => {
      expect(packageDirectoryNameWithVersionFromPath("/home/user/DefinitelyTyped/types/jquery")).toBe("jquery");
    });

    it("returns name/version for versioned path", () => {
      expect(packageDirectoryNameWithVersionFromPath("/home/user/DefinitelyTyped/types/react/v16")).toBe("react/v16");
    });

    it("returns name/version for minor-versioned path", () => {
      expect(packageDirectoryNameWithVersionFromPath("/home/user/DefinitelyTyped/types/express/v0.5")).toBe(
        "express/v0.5",
      );
    });

    it("returns just package name for ts-versioned path", () => {
      // ts3.6 is not a version directory for packageDirectoryNameWithVersionFromPath
      expect(packageDirectoryNameWithVersionFromPath("/home/user/DefinitelyTyped/types/node/ts3.6")).toBe("node");
    });

    it("handles Windows paths", () => {
      expect(packageDirectoryNameWithVersionFromPath("C:\\DefinitelyTyped\\types\\lodash")).toBe("lodash");
    });
  });

  describe("getCompilerOptions", () => {
    it("throws when tsconfig does not exist", () => {
      expect(() => getCompilerOptions("/nonexistent/tsconfig.json")).toThrow("does not exist");
    });

    it("reads and parses tsconfig.json", () => {
      const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "dtslint-test-"));
      const tsconfigPath = path.join(tmpDir, "tsconfig.json");
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: { strict: true, target: "es6" },
          files: ["index.d.ts"],
        }),
      );
      try {
        const result = getCompilerOptions(tsconfigPath);
        expect(result.compilerOptions).toBeDefined();
        expect(result.files).toEqual(["index.d.ts"]);
      } finally {
        fs.unlinkSync(tsconfigPath);
        fs.rmdirSync(tmpDir);
      }
    });

    it("reads tsconfig.json with comments", () => {
      const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "dtslint-test-"));
      const tsconfigPath = path.join(tmpDir, "tsconfig.json");
      fs.writeFileSync(
        tsconfigPath,
        `{
          // This is a comment
          "compilerOptions": { "strict": true },
          "files": ["index.d.ts"]
        }`,
      );
      try {
        const result = getCompilerOptions(tsconfigPath);
        expect(result.compilerOptions).toBeDefined();
        expect(result.compilerOptions.strict).toBe(true);
      } finally {
        fs.unlinkSync(tsconfigPath);
        fs.rmdirSync(tmpDir);
      }
    });
  });
});
