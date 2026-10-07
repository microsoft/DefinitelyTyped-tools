import assert from "node:assert/strict";
import { describe, it, beforeEach, before } from "node:test";
import { License } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { Range } from "semver";
import { getTypingInfo } from "../lib/definition-parser";
import { createMockDT } from "../mocks";
import {
  AllPackages,
  NotNeededPackage,
  TypingsData,
  TypingsVersions,
  getDependencyFromFile,
  getMangledNameForScopedPackage,
} from "../packages";
import { createTypingsVersionRaw } from "./utils";

describe(AllPackages.name, () => {
  let allPackages: AllPackages;

  before(async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1", "1.0.9999");
    allPackages = AllPackages.fromFS(dt.fs);
  });

  it("applies path mappings to test dependencies", async () => {
    const pkg = await allPackages.tryGetLatestVersion("has-older-test-dependency");
    for await (const { id } of allPackages.allDependencyTypings(pkg!)) {
      assert.deepEqual(id, { typesDirectoryName: "jquery", version: { major: 1, minor: 0 } });
    }
  });

  describe("getNotNeededPackage", () => {
    it("returns specified package", () => {
      const pkg = allPackages.getNotNeededPackage("angular");
      assert.ok(pkg);
      assert.equal(allPackages.getNotNeededPackage("non-existent"), undefined);
    });
  });

  describe("hasTypingFor", () => {
    it("returns true if typings exist", async () => {
      assert.equal(
        await allPackages.hasTypingFor({
          name: "@types/jquery",
          version: "*",
        }),
        true,
      );
      assert.equal(
        await allPackages.hasTypingFor({
          typesDirectoryName: "jquery",
          version: "*",
        }),
        true,
      );
      assert.equal(
        await allPackages.hasTypingFor({
          name: "@types/nonExistent",
          version: "*",
        }),
        false,
      );
    });
  });
});

describe(TypingsVersions.name, () => {
  let versions: TypingsVersions;

  before(async () => {
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
    assert.deepEqual(
      Array.from(versions.getAll()).map((v) => v.major),
      [3, 2, 2, 1],
    );
  });

  it("returns the latest version", () => {
    assert.deepEqual(versions.getLatest().major, 3);
  });

  it("finds the latest version when any version is wanted", () => {
    assert.deepEqual(versions.get(new Range("*")).major, 3);
  });

  it("finds the latest minor version for the given major version", () => {
    assert.deepEqual(versions.get(new Range("2")).major, 2);
    assert.deepEqual(versions.get(new Range("2")).minor, 5);
  });

  it("finds a specific version", () => {
    assert.deepEqual(versions.get(new Range("2.0")).major, 2);
    assert.deepEqual(versions.get(new Range("2.0")).minor, 0);
  });

  it("formats a version directory names", () => {
    assert.deepEqual(versions.get(new Range("2.0")).versionDirectoryName, "v2");
    assert.deepEqual(versions.get(new Range("2.0")).subDirectoryPath, "jquery/v2");
  });

  it("formats missing version error nicely", () => {
    assert.throws(
      () => versions.get(new Range("111.1001")),
      /Could not match version >=111\.1001\.0 <111\.1002\.0-0 in 3\.3\.9999,2\.5\.9999,2\.0\.9999,1\.0\.9999\. /,
    );
    assert.throws(
      () => versions.get(new Range("111")),
      /Could not match version >=111\.0\.0 <112\.0\.0-0 in 3\.3\.9999,2\.5\.9999,2\.0\.9999,1\.0\.9999\. /,
    );
  });
});

describe(TypingsData.name, () => {
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
      {
        "peer-dependency-1": "*",
      },
    );
    data = new TypingsData(dt.fs, versions["1.0"], true);
  });

  it("sets the correct properties", () => {
    assert.equal(data.name, "@types/known");
    assert.equal(data.typesDirectoryName, "known");
    assert.equal(data.libraryName, "known");
    assert.deepEqual(data.contributors, [
      {
        name: "Bender",
        url: "futurama.com",
      },
    ]);
    assert.equal(data.major, 1);
    assert.equal(data.minor, 0);
    assert.equal(data.minTypeScriptVersion, TypeScriptVersion.lowest);
    assert.deepEqual(data.typesVersions, []);
    assert.deepEqual(data.getFiles(), ["index.d.ts"]);
    assert.equal(data.license, License.MIT);
    assert.equal(data.getContentHash(), "f647d34b5793cea752bc5b892d2099c92f1ced5f13b8a4ec3e4826d9f9cd0163");
    assert.equal(data.projectName, "zombo.com");
    assert.deepEqual(data.dependencies, {
      "dependency-1": "*",
    });
    assert.deepEqual(data.devDependencies, {
      "@types/known": "workspace:.",
    });
    assert.deepEqual(data.peerDependencies, {
      "peer-dependency-1": "*",
    });
    assert.deepEqual(data.id, {
      typesDirectoryName: "known",
      version: {
        major: 1,
        minor: 0,
      },
    });
    assert.equal(data.isNotNeeded(), false);
  });

  describe("desc", () => {
    it("returns the name if latest version", () => {
      assert.equal(data.desc, "@types/known");
    });

    it("returns the versioned name if not latest", () => {
      const versions = createTypingsVersionRaw("known", {}, {});
      data = new TypingsData(createMockDT().fs, versions["1.0"], false);

      assert.equal(data.desc, "@types/known v1.0");
    });
  });

  describe("typesDirectoryName", () => {
    it("returns unscoped name", () => {
      assert.equal(data.typesDirectoryName, "known");
    });

    it("returns mangled name if scoped", () => {
      const versions = createTypingsVersionRaw("@foo/bar", {}, {});
      data = new TypingsData(createMockDT().fs, versions["1.0"], false);

      assert.equal(data.typesDirectoryName, "foo__bar");
    });
  });
});

describe(getMangledNameForScopedPackage.name, () => {
  it("returns unscoped names as-is", () => {
    assert.equal(getMangledNameForScopedPackage("foo"), "foo");
  });

  it("returns mangled names for scoped packages", () => {
    assert.equal(getMangledNameForScopedPackage("@foo/bar"), "foo__bar");
  });
});

describe(NotNeededPackage.name, () => {
  let data: NotNeededPackage;

  beforeEach(() => {
    data = new NotNeededPackage("types-package", "real-package", "1.0.0");
  });

  it("sets the correct properties", () => {
    assert.equal(data.license, License.MIT);
    assert.equal(data.name, "@types/types-package");
    assert.equal(data.libraryName, "real-package");
    assert.partialDeepStrictEqual(data.version, {
      major: 1,
      minor: 0,
      patch: 0,
    });
    assert.equal(data.major, 1);
    assert.equal(data.minor, 0);
    assert.equal(data.isLatest, true);
    assert.equal(data.isNotNeeded(), true);
    assert.equal(data.minTypeScriptVersion, TypeScriptVersion.lowest);
    assert.equal(
      data.deprecatedMessage(),
      "This is a stub types definition. real-package provides its own type definitions, so you do not need this installed.",
    );
  });

  describe("fromRaw", () => {
    it("throws on uppercase package name", () => {
      assert.throws(
        () => NotNeededPackage.fromRaw("noUISlider", { libraryName: "nouislider", asOfVersion: "16.0.0" }),
        /not-needed package 'noUISlider' must use all lower-case letters\./,
      );
    });
    it("throws on uppercase library name", () => {
      assert.throws(
        () => NotNeededPackage.fromRaw("nouislider", { libraryName: "noUISlider", asOfVersion: "16.0.0" }),
        /not-needed package 'nouislider' must use a libraryName that is all lower-case letters\./,
      );
    });
  });
});

describe(getDependencyFromFile.name, () => {
  it("returns undefined for unversioned paths", () => {
    assert.equal(getDependencyFromFile("types/a"), undefined);
  });

  it("returns undefined if not in types directory", () => {
    assert.equal(getDependencyFromFile("foo/bar/v3/baz"), undefined);
  });

  it("returns parsed version for versioned paths", () => {
    assert.deepEqual(getDependencyFromFile("types/a/v3.5"), {
      typesDirectoryName: "a",
      version: {
        major: 3,
        minor: 5,
      },
    });
    assert.deepEqual(getDependencyFromFile("types/a/v3"), {
      typesDirectoryName: "a",
      version: {
        major: 3,
        minor: undefined,
      },
    });
  });

  it("returns undefined for unversioned subpaths", () => {
    assert.deepEqual(getDependencyFromFile("types/a/vnotaversion"), {
      typesDirectoryName: "a",
      version: "*",
    });
  });

  it("returns undefined on package's scripts directory", () => {
    assert.equal(getDependencyFromFile("types/a/scripts"), "scripts");
  });

  it("returns undefined on package's scripts directory with overridden tsVersion", () => {
    assert.equal(getDependencyFromFile("types/a/ts4.8/scripts"), "scripts");
  });

  it("returns undefined on package's scripts directory with overridden packageVersion", () => {
    assert.equal(getDependencyFromFile("types/a/v18/scripts"), "scripts");
  });

  it("returns undefined on package's scripts directory with overridden packageVersion and tsVersion", () => {
    assert.equal(getDependencyFromFile("types/a/v18/ts4.8/scripts"), "scripts");
  });
});
