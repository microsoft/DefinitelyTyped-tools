import { License } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { Range } from "semver";
import { getTypingInfo } from "../src/lib/definition-parser";
import { createMockDT } from "../src/mocks";
import {
  AllPackages,
  NotNeededPackage,
  TypingsData,
  TypingsVersions,
  getDependencyFromFile,
  getMangledNameForScopedPackage,
} from "../src/packages";
import { createTypingsVersionRaw } from "./utils";

describe(AllPackages, () => {
  let allPackages: AllPackages;

  beforeAll(async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1", "1.0.9999");
    allPackages = AllPackages.fromFS(dt.fs);
  });

  it("applies path mappings to test dependencies", async () => {
    const pkg = await allPackages.tryGetLatestVersion("has-older-test-dependency");
    for await (const { id } of allPackages.allDependencyTypings(pkg!)) {
      expect(id).toEqual({ typesDirectoryName: "jquery", version: { major: 1, minor: 0 } });
    }
  });

  describe("getNotNeededPackage", () => {
    it("returns specified package", () => {
      const pkg = allPackages.getNotNeededPackage("angular");
      expect(pkg).toBeTruthy();
      expect(allPackages.getNotNeededPackage("non-existent")).toBe(undefined);
    });
  });

  describe("hasTypingFor", () => {
    it("returns true if typings exist", async () => {
      expect(
        await allPackages.hasTypingFor({
          name: "@types/jquery",
          version: "*",
        }),
      ).toBe(true);
      expect(
        await allPackages.hasTypingFor({
          typesDirectoryName: "jquery",
          version: "*",
        }),
      ).toBe(true);
      expect(
        await allPackages.hasTypingFor({
          name: "@types/nonExistent",
          version: "*",
        }),
      ).toBe(false);
    });
  });
});

describe(TypingsVersions, () => {
  let versions: TypingsVersions;

  beforeAll(async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1", "1.0.9999");
    dt.addOldVersionOfPackage("jquery", "2", "2.0.9999");
    dt.addOldVersionOfPackage("jquery", "2.5", "2.5.9999");
    const info = await getTypingInfo("jquery", dt.fs);
    if (Array.isArray(info)) {
      throw new Error(info.join("\n"));
    }
    versions = new TypingsVersions(dt.fs, info!);
  });

  it("sorts the data from latest to oldest version", () => {
    expect(Array.from(versions.getAll()).map((v) => v.major)).toEqual([3, 2, 2, 1]);
  });

  it("returns the latest version", () => {
    expect(versions.getLatest().major).toEqual(3);
  });

  it("finds the latest version when any version is wanted", () => {
    expect(versions.get(new Range("*")).major).toEqual(3);
  });

  it("finds the latest minor version for the given major version", () => {
    expect(versions.get(new Range("2")).major).toEqual(2);
    expect(versions.get(new Range("2")).minor).toEqual(5);
  });

  it("finds a specific version", () => {
    expect(versions.get(new Range("2.0")).major).toEqual(2);
    expect(versions.get(new Range("2.0")).minor).toEqual(0);
  });

  it("formats a version directory names", () => {
    expect(versions.get(new Range("2.0")).versionDirectoryName).toEqual("v2");
    expect(versions.get(new Range("2.0")).subDirectoryPath).toEqual("jquery/v2");
  });

  it("formats missing version error nicely", () => {
    expect(() => versions.get(new Range("111.1001"))).toThrow(
      "Could not match version >=111.1001.0 <111.1002.0-0 in 3.3.9999,2.5.9999,2.0.9999,1.0.9999. ",
    );
    expect(() => versions.get(new Range("111"))).toThrow(
      "Could not match version >=111.0.0 <112.0.0-0 in 3.3.9999,2.5.9999,2.0.9999,1.0.9999. ",
    );
  });
});

describe(TypingsData, () => {
  let data: TypingsData;

  beforeEach(() => {
    const dt = createMockDT();
    dt.pkgDir("known")
      .set(
        "package.json",
        JSON.stringify({
          name: "@types/known",
        }),
      )
      .set("index.d.ts", "declare const x: number;")
      .set("tsconfig.json", `{ "files": ["index.d.ts"] }`);

    const versions = createTypingsVersionRaw(
      "known",
      {
        "dependency-1": "*",
      },
      {
        "@types/known": "workspace:.",
      },
    );
    data = new TypingsData(dt.fs, versions["1.0"], true);
  });

  it("sets the correct properties", () => {
    expect(data.name).toBe("@types/known");
    expect(data.typesDirectoryName).toBe("known");
    expect(data.libraryName).toBe("known");
    expect(data.contributors).toEqual([
      {
        name: "Bender",
        url: "futurama.com",
      },
    ]);
    expect(data.major).toBe(1);
    expect(data.minor).toBe(0);
    expect(data.minTypeScriptVersion).toBe(TypeScriptVersion.lowest);
    expect(data.typesVersions).toEqual([]);
    expect(data.getFiles()).toEqual(["index.d.ts"]);
    expect(data.license).toBe(License.MIT);
    expect(data.getContentHash()).toBe("f647d34b5793cea752bc5b892d2099c92f1ced5f13b8a4ec3e4826d9f9cd0163");
    expect(data.projectName).toBe("zombo.com");
    expect(data.dependencies).toEqual({
      "dependency-1": "*",
    });
    expect(data.devDependencies).toEqual({
      "@types/known": "workspace:.",
    });
    expect(data.id).toEqual({
      typesDirectoryName: "known",
      version: {
        major: 1,
        minor: 0,
      },
    });
    expect(data.isNotNeeded()).toBe(false);
  });

  describe("desc", () => {
    it("returns the name if latest version", () => {
      expect(data.desc).toBe("@types/known");
    });

    it("returns the versioned name if not latest", () => {
      const versions = createTypingsVersionRaw("known", {}, {});
      data = new TypingsData(createMockDT().fs, versions["1.0"], false);

      expect(data.desc).toBe("@types/known v1.0");
    });
  });

  describe("typesDirectoryName", () => {
    it("returns unscoped name", () => {
      expect(data.typesDirectoryName).toBe("known");
    });

    it("returns mangled name if scoped", () => {
      const versions = createTypingsVersionRaw("@foo/bar", {}, {});
      data = new TypingsData(createMockDT().fs, versions["1.0"], false);

      expect(data.typesDirectoryName).toBe("foo__bar");
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
    expect(data.name).toBe("@types/types-package");
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
    expect(data.minTypeScriptVersion).toBe(TypeScriptVersion.lowest);
    expect(data.deprecatedMessage()).toBe(
      "This is a stub types definition. real-package provides its own type definitions, so you do not need this installed.",
    );
  });

  describe("fromRaw", () => {
    it("throws on uppercase package name", () => {
      expect(() =>
        NotNeededPackage.fromRaw("noUISlider", { libraryName: "nouislider", asOfVersion: "16.0.0" }),
      ).toThrow("not-needed package 'noUISlider' must use all lower-case letters.");
    });
    it("throws on uppercase library name", () => {
      expect(() =>
        NotNeededPackage.fromRaw("nouislider", { libraryName: "noUISlider", asOfVersion: "16.0.0" }),
      ).toThrow("not-needed package 'nouislider' must use a libraryName that is all lower-case letters.");
    });
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
      typesDirectoryName: "a",
      version: {
        major: 3,
        minor: 5,
      },
    });
    expect(getDependencyFromFile("types/a/v3")).toEqual({
      typesDirectoryName: "a",
      version: {
        major: 3,
        minor: undefined,
      },
    });
  });

  it("returns undefined for unversioned subpaths", () => {
    expect(getDependencyFromFile("types/a/vnotaversion")).toEqual({
      typesDirectoryName: "a",
      version: "*",
    });
  });

  it("returns undefined on package's scripts directory", () => {
    expect(getDependencyFromFile("types/a/scripts")).toBe(undefined);
  });

  it("returns undefined on package's scripts directory with overridden tsVersion", () => {
    expect(getDependencyFromFile("types/a/ts4.8/scripts")).toBe(undefined);
  });

  it("returns undefined on package's scripts directory with overridden packageVersion", () => {
    expect(getDependencyFromFile("types/a/v18/scripts")).toBe(undefined);
  });

  it("returns undefined on package's scripts directory with overridden packageVersion and tsVersion", () => {
    expect(getDependencyFromFile("types/a/v18/ts4.8/scripts")).toBe(undefined);
  });
});
