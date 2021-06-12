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
      expect(removeVersionFromPackageName("foov10")).toBe("foov10");
      expect(removeVersionFromPackageName("foo/V10")).toBe("foo/V10");
    });

    it("for versioned package returns package name only", () => {
      expect(removeVersionFromPackageName("@ckeditor/ckeditor5-utils/v10")).toBe("@ckeditor/ckeditor5-utils");
      expect(removeVersionFromPackageName("@foo/bar/v999.888")).toBe("@foo/bar");
      expect(removeVersionFromPackageName("@foo/bar/v0")).toBe("@foo/bar");
      expect(removeVersionFromPackageName("@foo/bar/V999")).toBe("@foo/bar/V999");
    });

    it("keeps wildcard path mappings for scoped versioned packages", () => {
      expect(removeVersionFromPackageName("@ckeditor/ckeditor5-utils/*")).toBe("@ckeditor/ckeditor5-utils/*");
      expect(removeVersionFromPackageName("@ckeditor/ckeditor5-utils/v10/*")).toBe("@ckeditor/ckeditor5-utils/*");
      expect(removeVersionFromPackageName("@ckeditor/ckeditor5-utils/v10.11/*")).toBe("@ckeditor/ckeditor5-utils/*");
    });

    it("keeps wildcard path mappings for versioned packages", () => {
      expect(removeVersionFromPackageName("foobar/*")).toBe("foobar/*");
      expect(removeVersionFromPackageName("foobar/v10/*")).toBe("foobar/*");
      expect(removeVersionFromPackageName("foobar/v10.110/*")).toBe("foobar/*");
    });
  });
});
