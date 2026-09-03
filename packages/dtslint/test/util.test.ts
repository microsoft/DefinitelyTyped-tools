/// <reference types="jest" />
import { packageNameFromPath, packageDirectoryNameWithVersionFromPath } from "../src/util";

describe("util", () => {
  describe("packageNameFromPath", () => {
    it("returns base name for a simple package path", () => {
      expect(packageNameFromPath("/types/jquery")).toBe("jquery");
    });

    it("returns parent name when path ends with a version directory (v14)", () => {
      expect(packageNameFromPath("/types/node/v14")).toBe("node");
    });

    it("returns parent name when path ends with a minor version directory (v0.69)", () => {
      expect(packageNameFromPath("/types/react-native/v0.69")).toBe("react-native");
    });

    it("returns parent name when path ends with ts version directory (ts5.0)", () => {
      expect(packageNameFromPath("/types/some-pkg/ts5.0")).toBe("some-pkg");
    });

    it("returns base name when path does not end with version pattern", () => {
      expect(packageNameFromPath("/types/some-pkg/subdir")).toBe("subdir");
    });

    it("handles Windows-style paths", () => {
      expect(packageNameFromPath("C:\\types\\jquery")).toBe("jquery");
    });

    it("handles Windows-style paths with version directory", () => {
      expect(packageNameFromPath("C:\\types\\node\\v14")).toBe("node");
    });

    it("returns parent for version pattern v1", () => {
      expect(packageNameFromPath("/types/lodash/v1")).toBe("lodash");
    });

    it("handles scoped-like package names", () => {
      expect(packageNameFromPath("/types/bla__foo")).toBe("bla__foo");
    });
  });

  describe("packageDirectoryNameWithVersionFromPath", () => {
    it("returns just the package name when no version directory", () => {
      expect(packageDirectoryNameWithVersionFromPath("/types/jquery")).toBe("jquery");
    });

    it("returns package/version when path ends with version directory", () => {
      expect(packageDirectoryNameWithVersionFromPath("/types/node/v14")).toBe("node/v14");
    });

    it("returns package/version for minor version directories", () => {
      expect(packageDirectoryNameWithVersionFromPath("/types/react-native/v0.69")).toBe("react-native/v0.69");
    });

    it("returns just the subdir name when last segment is not a version", () => {
      expect(packageDirectoryNameWithVersionFromPath("/types/pkg/subdir")).toBe("subdir");
    });

    it("handles Windows-style paths without version", () => {
      expect(packageDirectoryNameWithVersionFromPath("C:\\types\\jquery")).toBe("jquery");
    });

    it("handles Windows-style paths with version", () => {
      expect(packageDirectoryNameWithVersionFromPath("C:\\types\\node\\v14")).toBe("node/v14");
    });
  });
});
