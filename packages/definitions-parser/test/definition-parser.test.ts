import { createMockDT } from "../src/mocks";
import { getTypingInfo } from "../src/lib/definition-parser";

describe(getTypingInfo, () => {
  it("keys data by major.minor version", async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1.42");
    dt.addOldVersionOfPackage("jquery", "2");
    const info = await getTypingInfo("jquery", dt.pkgFS("jquery"));

    expect(Object.keys(info).sort()).toEqual(["1.42", "2.0", "3.3"]);
  });

  it("works for a package with dependencies", async () => {
    const dt = createMockDT();
    const info = await getTypingInfo("has-dependency", dt.pkgFS("has-dependency"));
    expect(info).toBeDefined();
  });

  describe("concerning multiple versions", () => {
    it("records what the version directory looks like on disk", async () => {
      const dt = createMockDT();
      dt.addOldVersionOfPackage("jquery", "2");
      dt.addOldVersionOfPackage("jquery", "1.5");
      const info = await getTypingInfo("jquery", dt.pkgFS("jquery"));

      expect(info).toEqual({
        "1.5": expect.objectContaining({
          libraryVersionDirectoryName: "1.5"
        }),
        "2.0": expect.objectContaining({
          libraryVersionDirectoryName: "2"
        }),
        "3.3": expect.objectContaining({
          // The latest version does not have its own version directory
          libraryVersionDirectoryName: undefined
        })
      });
    });

    it("records a path mapping to the version directory", async () => {
      const dt = createMockDT();
      dt.addOldVersionOfPackage("jquery", "2");
      dt.addOldVersionOfPackage("jquery", "1.5");
      const info = await getTypingInfo("jquery", dt.pkgFS("jquery"));

      expect(info).toEqual({
        "1.5": expect.objectContaining({
          pathMappings: {
            jquery: { major: 1, minor: 5 }
          }
        }),
        "2.0": expect.objectContaining({
          pathMappings: {
            jquery: { major: 2, minor: undefined }
          }
        }),
        "3.3": expect.objectContaining({
          // The latest version does not have path mappings of its own
          pathMappings: {}
        })
      });
    });

    describe("validation thereof", () => {
      it("throws if a directory exists for the latest major version", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3");

        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).rejects.toThrow(
          "The latest version of the 'jquery' package is 3.3, so the subdirectory 'v3' is not allowed; " +
            "since it applies to any 3.* version, up to and including 3.3."
        );
      });

      it("throws if a directory exists for the latest minor version", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3.3");

        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).rejects.toThrow(
          "The latest version of the 'jquery' package is 3.3, so the subdirectory 'v3.3' is not allowed."
        );
      });

      it("does not throw when a minor version is older than the latest", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3.0");

        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).resolves.toBeDefined();
      });

      it("checks that older versions with non-relative imports have wildcard path mappings", () => {
        const dt = createMockDT();
        const jquery = dt.pkgDir("jquery");
        jquery.set(
          "JQuery.d.ts",
          `import "jquery/component";
`
        );
        dt.addOldVersionOfPackage("jquery", "1");
        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).rejects.toThrow(
          'jquery: Older version 1 must have a "paths" entry of "jquery/*": ["jquery/v1/*"]'
        );
      });
    });
  });
});
