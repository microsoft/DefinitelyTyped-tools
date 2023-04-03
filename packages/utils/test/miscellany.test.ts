import { unmangleScopedPackage } from "../src/miscellany";

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
});
