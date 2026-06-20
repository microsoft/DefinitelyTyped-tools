/// <reference types="jest" />
import {
  findDTRoot,
  assertPathIsNotBanned,
  combineErrorsAndWarnings,
  assertPathIsInDefinitelyTyped,
  checkExpectedFiles,
} from "../src/index-helpers";
import fs from "fs";
import path from "path";
import os from "os";

describe("index-helpers", () => {
  describe("findDTRoot", () => {
    it("finds root for a path with /types/ directory", () => {
      // findDTRoot walks up until basename is "types", then returns dirname
      const result = findDTRoot("/home/user/DefinitelyTyped/types/jquery");
      expect(result).toBe("/home/user/DefinitelyTyped");
    });

    it("finds root for a versioned subpackage path", () => {
      const result = findDTRoot("/home/user/DefinitelyTyped/types/react/v16");
      expect(result).toBe("/home/user/DefinitelyTyped");
    });

    it("returns parent of '.' for non-types path (stops at '.')", () => {
      // When no 'types' directory is found, it stops when dirname is "." or "/"
      const result = findDTRoot("some/random/path");
      expect(result).toBe(".");
    });
  });

  describe("assertPathIsNotBanned", () => {
    it("allows regular package names", () => {
      expect(() => assertPathIsNotBanned("lodash")).not.toThrow();
    });

    it("allows 'download' (exempted)", () => {
      expect(() => assertPathIsNotBanned("download")).not.toThrow();
    });

    it("allows 'downloadjs' (exempted)", () => {
      expect(() => assertPathIsNotBanned("downloadjs")).not.toThrow();
    });

    it("allows 's3-download-stream' (exempted)", () => {
      expect(() => assertPathIsNotBanned("s3-download-stream")).not.toThrow();
    });

    it("bans packages containing 'download' as a word boundary", () => {
      expect(() => assertPathIsNotBanned("my-download-tool")).toThrow("banned by npm");
    });

    it("bans packages starting with 'download-'", () => {
      expect(() => assertPathIsNotBanned("download-helper")).toThrow("banned by npm");
    });

    it("bans packages ending with '-download'", () => {
      expect(() => assertPathIsNotBanned("file-download")).toThrow("banned by npm");
    });

    it("allows packages where 'download' is part of a larger word", () => {
      // 'downloads' ends with a word character, so ($|\W) won't match for the 's'
      // But actually /(^|\W)download($|\W)/ checks for word boundaries
      // 'mydownloader' - 'download' is embedded, but preceded by 'y' (a word char), so (^|\W) fails
      expect(() => assertPathIsNotBanned("mydownloader")).not.toThrow();
    });
  });

  describe("combineErrorsAndWarnings", () => {
    it("returns empty string when no errors and no warnings", () => {
      const result = combineErrorsAndWarnings([], []);
      expect(result).toBe("");
    });

    it("returns warning string when no errors", () => {
      const result = combineErrorsAndWarnings([], ["warning1", "warning2"]);
      expect(typeof result).toBe("string");
      expect(result as string).toContain("warning1");
      expect(result as string).toContain("warning2");
    });

    it("returns Error when there are errors", () => {
      const result = combineErrorsAndWarnings(["error1"], []);
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("error1");
    });

    it("returns Error with both errors and warnings", () => {
      const result = combineErrorsAndWarnings(["error1"], ["warning1"]);
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("error1");
      expect((result as Error).message).toContain("warning1");
    });

    it("separates messages with double newlines", () => {
      const result = combineErrorsAndWarnings(["err1", "err2"], []);
      expect((result as Error).message).toBe("err1\n\nerr2");
    });
  });

  describe("assertPathIsInDefinitelyTyped", () => {
    it("throws when types directory does not exist under dtRoot", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtslint-test-"));
      try {
        expect(() => assertPathIsInDefinitelyTyped("/some/path", tmpDir)).toThrow(
          "not in a `DefinitelyTyped/types/xxx` directory",
        );
      } finally {
        fs.rmdirSync(tmpDir);
      }
    });

    it("does not throw when types directory exists under dtRoot", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtslint-test-"));
      const typesDir = path.join(tmpDir, "types");
      fs.mkdirSync(typesDir);
      try {
        expect(() => assertPathIsInDefinitelyTyped("/some/path", tmpDir)).not.toThrow();
      } finally {
        fs.rmdirSync(typesDir);
        fs.rmdirSync(tmpDir);
      }
    });
  });

  describe("checkExpectedFiles", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtslint-expected-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("errors when index.d.ts is missing (isLatest=false)", () => {
      const result = checkExpectedFiles(tmpDir, false);
      expect(result.errors).toContainEqual(expect.stringContaining("Must contain 'index.d.ts'"));
    });

    it("no errors for missing index.d.ts when index.d.ts exists (isLatest=false)", () => {
      fs.writeFileSync(path.join(tmpDir, "index.d.ts"), "export {};");
      const result = checkExpectedFiles(tmpDir, false);
      expect(result.errors.filter((e) => e.includes("index.d.ts"))).toEqual([]);
    });

    it("errors when tslint.json exists", () => {
      fs.writeFileSync(path.join(tmpDir, "index.d.ts"), "export {};");
      fs.writeFileSync(path.join(tmpDir, "tslint.json"), "{}");
      const result = checkExpectedFiles(tmpDir, false);
      expect(result.errors).toContainEqual(expect.stringContaining("Should not contain 'tslint.json'"));
    });

    it("errors when .npmignore is missing (isLatest=true, under types/)", () => {
      // Create a structure: <tmp>/types/mypackage/
      const typesDir = path.join(tmpDir, "types");
      fs.mkdirSync(typesDir);
      const pkgDir = path.join(typesDir, "mypackage");
      fs.mkdirSync(pkgDir);
      fs.writeFileSync(path.join(pkgDir, "index.d.ts"), "export {};");

      const result = checkExpectedFiles(pkgDir, true);
      expect(result.errors).toContainEqual(expect.stringContaining("Missing '.npmignore'"));
    });

    it("errors when .npmignore is incorrect (isLatest=true, under types/)", () => {
      const typesDir = path.join(tmpDir, "types");
      fs.mkdirSync(typesDir);
      const pkgDir = path.join(typesDir, "mypackage");
      fs.mkdirSync(pkgDir);
      fs.writeFileSync(path.join(pkgDir, "index.d.ts"), "export {};");
      fs.writeFileSync(path.join(pkgDir, ".npmignore"), "wrong content");

      const result = checkExpectedFiles(pkgDir, true);
      expect(result.errors).toContainEqual(expect.stringContaining("Incorrect '.npmignore'"));
    });

    it("no .npmignore errors when correct (isLatest=true, under types/)", () => {
      const typesDir = path.join(tmpDir, "types");
      fs.mkdirSync(typesDir);
      const pkgDir = path.join(typesDir, "mypackage");
      fs.mkdirSync(pkgDir);
      fs.writeFileSync(path.join(pkgDir, "index.d.ts"), "export {};");
      const npmIgnore = ["*", "!**/*.d.ts", "!**/*.d.cts", "!**/*.d.mts", "!**/*.d.*.ts"].join("\n");
      fs.writeFileSync(path.join(pkgDir, ".npmignore"), npmIgnore);

      const result = checkExpectedFiles(pkgDir, true);
      const npmIgnoreErrors = result.errors.filter((e) => e.includes(".npmignore"));
      expect(npmIgnoreErrors).toEqual([]);
    });

    it("includes version directories in expected .npmignore", () => {
      const typesDir = path.join(tmpDir, "types");
      fs.mkdirSync(typesDir);
      const pkgDir = path.join(typesDir, "mypackage");
      fs.mkdirSync(pkgDir);
      fs.writeFileSync(path.join(pkgDir, "index.d.ts"), "export {};");
      fs.mkdirSync(path.join(pkgDir, "v16"));
      // The .npmignore should include /v16/
      const npmIgnoreWithVersion = [
        "*",
        "!**/*.d.ts",
        "!**/*.d.cts",
        "!**/*.d.mts",
        "!**/*.d.*.ts",
        "/v16/",
      ].join("\n");
      fs.writeFileSync(path.join(pkgDir, ".npmignore"), npmIgnoreWithVersion);

      const result = checkExpectedFiles(pkgDir, true);
      const npmIgnoreErrors = result.errors.filter((e) => e.includes(".npmignore"));
      expect(npmIgnoreErrors).toEqual([]);
    });

    it("errors when OTHER_FILES.txt exists (isLatest=true)", () => {
      const typesDir = path.join(tmpDir, "types");
      fs.mkdirSync(typesDir);
      const pkgDir = path.join(typesDir, "mypackage");
      fs.mkdirSync(pkgDir);
      fs.writeFileSync(path.join(pkgDir, "index.d.ts"), "export {};");
      const npmIgnore = ["*", "!**/*.d.ts", "!**/*.d.cts", "!**/*.d.mts", "!**/*.d.*.ts"].join("\n");
      fs.writeFileSync(path.join(pkgDir, ".npmignore"), npmIgnore);
      fs.writeFileSync(path.join(pkgDir, "OTHER_FILES.txt"), "some files");

      const result = checkExpectedFiles(pkgDir, true);
      expect(result.errors).toContainEqual(expect.stringContaining("OTHER_FILES.txt"));
    });

    it("checks parent .npmignore for versioned subdirectory (isLatest=true)", () => {
      // Structure: <tmp>/mypackage/v16/ (parent is not "types")
      const pkgDir = path.join(tmpDir, "mypackage");
      fs.mkdirSync(pkgDir);
      const versionDir = path.join(pkgDir, "v16");
      fs.mkdirSync(versionDir);
      fs.writeFileSync(path.join(versionDir, "index.d.ts"), "export {};");
      // No parent .npmignore
      const result = checkExpectedFiles(versionDir, true);
      expect(result.errors).toContainEqual(expect.stringContaining("Missing parent '.npmignore'"));
    });

    it("errors when parent .npmignore doesn't contain versioned dir entry", () => {
      const pkgDir = path.join(tmpDir, "mypackage");
      fs.mkdirSync(pkgDir);
      const versionDir = path.join(pkgDir, "v16");
      fs.mkdirSync(versionDir);
      fs.writeFileSync(path.join(versionDir, "index.d.ts"), "export {};");
      const npmIgnore = ["*", "!**/*.d.ts", "!**/*.d.cts", "!**/*.d.mts", "!**/*.d.*.ts"].join("\n");
      fs.writeFileSync(path.join(versionDir, ".npmignore"), npmIgnore);
      // Parent .npmignore without /v16/ entry
      fs.writeFileSync(path.join(pkgDir, ".npmignore"), "* \n!**/*.d.ts");

      const result = checkExpectedFiles(versionDir, true);
      expect(result.errors).toContainEqual(expect.stringContaining("should contain /v16/"));
    });
  });
});
