import { removeVersionFromPackageName, unmangleScopedPackage } from "../src/miscellany";

describe("miscellany", () => {
  describe(unmangleScopedPackage, () => {
    it("for unscoped package returns undefined", () => {
      expect(unmangleScopedPackage("foobar")).toBeUndefined();
      expect(unmangleScopedPackage("utils")).toBeUndefined();
    });

    it("for scoped package returns unmangled name", () => {
      expect(unmangleScopedPackage("foo__bar")).toBe("@foo/bar");
      expect(unmangleScopedPackage("definitelytyped__utils")).toBe("@definitelytyped/utils");
    });
  });

  describe(removeVersionFromPackageName, () => {
    it("for non versioned package returns package", () => {
      expect(removeVersionFromPackageName("@ckeditor/ckeditor5-utils")).toBe("@ckeditor/ckeditor5-utils");
      expect(removeVersionFromPackageName("@foo/bar")).toBe("@foo/bar");
    });

    it("for versioned package returns package name only", () => {
      expect(removeVersionFromPackageName("@ckeditor/ckeditor5-utils/v10")).toBe("@ckeditor/ckeditor5-utils");
      expect(removeVersionFromPackageName("@foo/bar/v0")).toBe("@foo/bar");
      expect(removeVersionFromPackageName("@foo/bar/V999")).toBe("@foo/bar");
    });
  });
});
