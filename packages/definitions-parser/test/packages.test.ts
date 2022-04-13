import { createMockDT } from "../src/mocks";
import { getTypingInfo } from "../src/lib/definition-parser";
import {
  AllPackages,
  TypingsVersions,
  TypingsData,
  License,
  getMangledNameForScopedPackage,
  NotNeededPackage,
  getLicenseFromPackageJson,
  getDependencyFromFile,
} from "../src/packages";
import { parseDefinitions } from "../src/parse-definitions";
import { quietLoggerWithErrors } from "@definitelytyped/utils";
import { createTypingsVersionRaw } from "./utils";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

describe(AllPackages, () => {
  let allPackages: AllPackages;

  beforeAll(async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1");
    const [log] = quietLoggerWithErrors();
    allPackages = await parseDefinitions(dt.fs, undefined, log);
  });

  it("applies path mappings to test dependencies", () => {
    const pkg = allPackages.tryGetLatestVersion("has-older-test-dependency")!;
    expect(Array.from(allPackages.allDependencyTypings(pkg), ({ id }) => id)).toEqual([
      { name: "jquery", version: { major: 1, minor: 0 } },
    ]);
  });

  describe("getNotNeededPackage", () => {
    it("returns specified package", () => {
      const pkg = allPackages.getNotNeededPackage("angular");
      expect(pkg).toBeTruthy();
      expect(allPackages.getNotNeededPackage("non-existent")).toBe(undefined);
    });
  });

  describe("hasTypingFor", () => {
    it("returns true if typings exist", () => {
      expect(
        allPackages.hasTypingFor({
          name: "jquery",
          version: "*",
        })
      ).toBe(true);
      expect(
        allPackages.hasTypingFor({
          name: "nonExistent",
          version: "*",
        })
      ).toBe(false);
    });
  });
});

describe(TypingsVersions, () => {
  let versions: TypingsVersions;

  beforeAll(async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1");
    dt.addOldVersionOfPackage("jquery", "2");
    dt.addOldVersionOfPackage("jquery", "2.5");
    versions = new TypingsVersions(await getTypingInfo("jquery", dt.pkgFS("jquery")));
  });

  it("sorts the data from latest to oldest version", () => {
    expect(Array.from(versions.getAll()).map((v) => v.major)).toEqual([3, 2, 2, 1]);
  });

  it("returns the latest version", () => {
    expect(versions.getLatest().major).toEqual(3);
  });

  it("finds the latest version when any version is wanted", () => {
    expect(versions.get("*").major).toEqual(3);
  });

  it("finds the latest minor version for the given major version", () => {
    expect(versions.get({ major: 2 }).major).toEqual(2);
    expect(versions.get({ major: 2 }).minor).toEqual(5);
  });

  it("finds a specific version", () => {
    expect(versions.get({ major: 2, minor: 0 }).major).toEqual(2);
    expect(versions.get({ major: 2, minor: 0 }).minor).toEqual(0);
  });

  it("formats a version directory names", () => {
    expect(versions.get({ major: 2, minor: 0 }).versionDirectoryName).toEqual("v2");
    expect(versions.get({ major: 2, minor: 0 }).subDirectoryPath).toEqual("jquery/v2");
  });

  it("formats missing version error nicely", () => {
    expect(() => versions.get({ major: 111, minor: 1001 })).toThrow("Could not find version 111.1001");
    expect(() => versions.get({ major: 111 })).toThrow("Could not find version 111.*");
  });
});

describe(TypingsData, () => {
  let data: TypingsData;

  beforeEach(() => {
    const versions = createTypingsVersionRaw(
      "known",
      {
        "dependency-1": "*",
      },
      [],
      {}
    );
    data = new TypingsData(versions["1.0"], true);
  });

  it("sets the correct properties", () => {
    expect(data.name).toBe("known");
    expect(data.testDependencies).toEqual([]);
    expect(data.contributors).toEqual([
      {
        name: "Bender",
        url: "futurama.com",
        githubUsername: "bender",
      },
    ]);
    expect(data.major).toBe(1);
    expect(data.minor).toBe(0);
    expect(data.minTypeScriptVersion).toBe(TypeScriptVersion.lowest);
    expect(data.typesVersions).toEqual([]);
    expect(data.files).toEqual(["index.d.ts"]);
    expect(data.license).toBe(License.MIT);
    expect(data.packageJsonDependencies).toEqual([]);
    expect(data.contentHash).toBe("11111111111111");
    expect(data.declaredModules).toEqual([]);
    expect(data.projectName).toBe("zombo.com");
    expect(data.globals).toEqual([]);
    expect(data.pathMappings).toEqual({});
    expect(data.dependencies).toEqual({
      "dependency-1": "*",
    });
    expect(data.id).toEqual({
      name: "known",
      version: {
        major: 1,
        minor: 0,
      },
    });
    expect(data.isNotNeeded()).toBe(false);
  });

  describe("unescapedName", () => {
    it("returns the name when unscoped", () => {
      expect(data.unescapedName).toBe("known");
    });

    it("returns scoped names correctly", () => {
      const versions = createTypingsVersionRaw("foo__bar", {}, [], {});
      data = new TypingsData(versions["1.0"], true);

      expect(data.unescapedName).toBe("@foo/bar");
    });
  });

  describe("desc", () => {
    it("returns the name if latest version", () => {
      expect(data.desc).toBe("known");
    });

    it("returns the verioned name if not latest", () => {
      const versions = createTypingsVersionRaw("known", {}, [], {});
      data = new TypingsData(versions["1.0"], false);

      expect(data.desc).toBe("known v1.0");
    });
  });

  describe("fullNpmName", () => {
    it("returns scoped name", () => {
      expect(data.fullNpmName).toBe("@types/known");
    });

    it("returns mangled name if scoped", () => {
      const versions = createTypingsVersionRaw("@foo/bar", {}, [], {});
      data = new TypingsData(versions["1.0"], false);

      expect(data.fullNpmName).toBe("@types/foo__bar");
    });
  });

  describe("fullEscapedNpmName", () => {
    it("returns escaped name", () => {
      expect(data.fullEscapedNpmName).toBe("@types%2fknown");
    });
  });
});

describe(getMangledNameForScopedPackage, () => {
  it("returns unscoped names as-is", () => {
    expect(getMangledNameForScopedPackage("foo")).toBe("foo");
  });

  it("returns mangled names for scoped packages", () => {
    expect(getMangledNameForScopedPackage("@foo/bar")).toBe("foo__bar");
  });
});

describe(NotNeededPackage, () => {
  let data: NotNeededPackage;

  beforeEach(() => {
    data = new NotNeededPackage("types-package", "real-package", "1.0.0");
  });

  it("sets the correct properties", () => {
    expect(data.license).toBe(License.MIT);
    expect(data.name).toBe("types-package");
    expect(data.libraryName).toBe("real-package");
    expect(data.version).toMatchObject({
      major: 1,
      minor: 0,
      patch: 0,
    });
    expect(data.major).toBe(1);
    expect(data.minor).toBe(0);
    expect(data.isLatest).toBe(true);
    expect(data.isNotNeeded()).toBe(true);
    expect(data.declaredModules).toEqual([]);
    expect(data.minTypeScriptVersion).toBe(TypeScriptVersion.lowest);
    expect(data.deprecatedMessage()).toBe(
      "This is a stub types definition. real-package provides its own type definitions, so you do not need this installed."
    );
  });

  describe("fromRaw", () => {
    it("throws on uppercase package name", () => {
      expect(() =>
        NotNeededPackage.fromRaw("noUISlider", { libraryName: "nouislider", asOfVersion: "16.0.0" })
      ).toThrow("not-needed package 'noUISlider' must use all lower-case letters.");
    });
    it("throws on uppercase library name", () => {
      expect(() =>
        NotNeededPackage.fromRaw("nouislider", { libraryName: "noUISlider", asOfVersion: "16.0.0" })
      ).toThrow("not-needed package 'nouislider' must use a libraryName that is all lower-case letters.");
    });
  });
});

describe(getLicenseFromPackageJson, () => {
  it("returns MIT by default", () => {
    expect(getLicenseFromPackageJson(undefined)).toBe(License.MIT);
  });

  it("throws if license is MIT", () => {
    expect(() => getLicenseFromPackageJson("MIT")).toThrow();
  });

  it("returns known licenses", () => {
    expect(getLicenseFromPackageJson(License.Apache20)).toBe(License.Apache20);
  });

  it("throws if unknown license", () => {
    expect(() => getLicenseFromPackageJson("nonsense")).toThrow();
  });
});

describe(getDependencyFromFile, () => {
  it("returns undefined for unversioned paths", () => {
    expect(getDependencyFromFile("types/a")).toBe(undefined);
  });

  it("returns undefined if not in types directory", () => {
    expect(getDependencyFromFile("foo/bar/v3/baz")).toBe(undefined);
  });

  it("returns parsed version for versioned paths", () => {
    expect(getDependencyFromFile("types/a/v3.5")).toEqual({
      name: "a",
      version: {
        major: 3,
        minor: 5,
      },
    });
    expect(getDependencyFromFile("types/a/v3")).toEqual({
      name: "a",
      version: {
        major: 3,
        minor: undefined,
      },
    });
  });

  it("returns undefined for unversioned subpaths", () => {
    expect(getDependencyFromFile("types/a/vnotaversion")).toEqual({
      name: "a",
      version: "*",
    });
  });
});
