import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePackageJson, makeTypesVersionsForPackageJson, License, getLicenseFromPackageJson } from "../index";

describe("validatePackageJson", () => {
  const pkgJson: Record<string, unknown> = {
    private: true,
    name: "@types/hapi",
    version: "18.0.9999",
    projects: ["https://github.com/hapijs/hapi", "https://hapijs.com"],
    minimumTypeScriptVersion: "4.2",
    dependencies: {
      "@types/boom": "*",
      "@types/catbox": "*",
      "@types/iron": "*",
      "@types/mimos": "*",
      "@types/node": "*",
      "@types/podium": "*",
      "@types/shot": "*",
      joi: "^17.3.0",
    },
    devDependencies: {
      "@types/hapi": "workspace:.",
    },
    owners: [
      {
        name: "Rafael Souza Fijalkowski",
        githubUsername: "rafaelsouzaf",
      },
      {
        name: "Justin Simms",
        url: "https://example.com/jhsimms",
      },
      {
        name: "Simon Schick",
        githubUsername: "SimonSchick",
      },
      {
        name: "Rodrigo Saboya",
        githubUsername: "saboya",
      },
    ],
  };
  const header = { ...pkgJson, nonNpm: false, libraryMajorVersion: 18, libraryMinorVersion: 0 };
  delete (header as any).dependencies;
  delete (header as any).devDependencies;
  delete (header as any).peerDependencies;
  delete (header as any).private;
  delete (header as any).version;
  it("requires private: true", () => {
    const pkg = { ...pkgJson };
    delete pkg.private;
    assert.deepEqual(validatePackageJson("hapi", pkg, []), [
      `hapi's package.json has bad "private": must be \`"private": true\``,
    ]);
  });
  it("requires name", () => {
    const pkg = { ...pkgJson };
    delete pkg.name;
    assert.deepEqual(validatePackageJson("hapi", pkg, []), [
      'hapi\'s package.json should have `"name": "@types/hapi"`',
    ]);
  });
  it("requires name to match", () => {
    assert.deepEqual(validatePackageJson("hapi", { ...pkgJson, name: "@types/sad" }, []), [
      'hapi\'s package.json should have `"name": "@types/hapi"`',
    ]);
  });
  it("requires devDependencies", () => {
    const pkg = { ...pkgJson };
    delete pkg.devDependencies;
    assert.deepEqual(validatePackageJson("hapi", pkg, []), [
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires devDependencies to contain self-package", () => {
    assert.deepEqual(validatePackageJson("hapi", { ...pkgJson, devDependencies: {} }, []), [
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires devDependencies to contain self-package version 'workspace:.'", () => {
    assert.deepEqual(validatePackageJson("hapi", { ...pkgJson, devDependencies: { "@types/hapi": "*" } }, []), [
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires version", () => {
    const pkg = { ...pkgJson };
    delete pkg.version;
    assert.deepEqual(validatePackageJson("hapi", pkg, []), [
      `hapi's package.json should have \`"version"\` matching the version of the implementation package.`,
    ]);
  });
  it("requires version to be NN.NN.NN", () => {
    assert.deepEqual(validatePackageJson("hapi", { ...pkgJson, version: "hi there" }, []), [
      `hapi's package.json has bad "version": "hi there" should look like "NN.NN.9999"`,
    ]);
  });
  it("requires version to end with .9999", () => {
    assert.deepEqual(validatePackageJson("hapi", { ...pkgJson, version: "1.2.3" }, []), [
      `hapi's package.json has bad "version": 1.2.3 must end with ".9999"`,
    ]);
  });
  it("works with old-version packages", () => {
    assert.ok(!Array.isArray(validatePackageJson("hapi", { ...pkgJson, version: "16.6.9999" }, [])));
  });
  it("requires dependency versions to be valid semver ranges, dist-tags, or 'workspace:.'", () => {
    assert.deepEqual(
      validatePackageJson(
        "hapi",
        { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: "not a range" } },
        [],
      ),
      [
        `hapi's package.json has bad "dependencies": version for joi ("not a range") must be a valid semver range, dist-tag, or "workspace:.".`,
      ],
    );
  });
  for (const row of [
    ["file:./local.tgz"],
    ["./local.tgz"],
    ["local.tgz"],
    ["foo.tar.gz"],
    ["git+https://example.com/x.git"],
    ["git+ssh://git@example.com:x/y.git"],
    ["git@example.com:x/y.git"],
    ["https://example.com/x.tgz"],
    ["http://example.com/x.tgz"],
    ["user/repo"],
    ["user/repo#branch"],
    ["npm:other@^1"],
    ["~/local"],
    ["../local"],
  ] as const) {
    it(`rejects non-registry dependency spec ${JSON.stringify(row[0])}`, () => {
      const [bad] = row;
      const result = validatePackageJson(
        "hapi",
        { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: bad } },
        [],
      );
      assert.equal(Array.isArray(result), true);
      assert.ok(
        (result as string[]).includes(
          `hapi's package.json has bad "dependencies": version for joi (${JSON.stringify(
            bad,
          )}) must be a valid semver range, dist-tag, or "workspace:.".`,
        ),
      );
    });
  }
  for (const row of [["latest"], ["next"], ["beta"], ["rc"], ["canary"], ["experimental"], ["nightly"]] as const) {
    it(`allows dist-tag ${JSON.stringify(row[0])} as a dependency version`, () => {
      const [tag] = row;
      assert.ok(
        !Array.isArray(
          validatePackageJson(
            "hapi",
            { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: tag } },
            [],
          ),
        ),
      );
    });
  }
  it("allows 'workspace:.' as a dependency version", () => {
    assert.ok(
      !Array.isArray(
        validatePackageJson(
          "hapi",
          { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: "workspace:." } },
          [],
        ),
      ),
    );
  });
  it("requires dependency versions to be strings", () => {
    assert.deepEqual(validatePackageJson("hapi", { ...pkgJson, peerDependencies: { foo: 5 } }, []), [
      `hapi's package.json has bad "peerDependencies": version for foo should be a string.`,
    ]);
  });
});

describe("makeTypesVersionsForPackageJson", () => {
  it("is undefined for empty versions", () => {
    assert.equal(makeTypesVersionsForPackageJson([]), undefined);
  });
  it("works for one version", () => {
    assert.deepEqual(makeTypesVersionsForPackageJson(["4.5"]), {
      "<=4.5": {
        "*": ["ts4.5/*"],
      },
    });
  });
  it("orders versions old to new  with old-to-new input", () => {
    assert.deepEqual(
      JSON.stringify(makeTypesVersionsForPackageJson(["4.8", "5.0", "5.2"]), undefined, 4),
      `{
    "<=4.8": {
        "*": [
            "ts4.8/*"
        ]
    },
    "<=5.0": {
        "*": [
            "ts5.0/*"
        ]
    },
    "<=5.2": {
        "*": [
            "ts5.2/*"
        ]
    }
}`,
    );
  });
  it("orders versions old to new  with new-to-old input", () => {
    assert.deepEqual(
      JSON.stringify(makeTypesVersionsForPackageJson(["5.2", "5.0", "4.8"]), undefined, 4),
      `{
    "<=4.8": {
        "*": [
            "ts4.8/*"
        ]
    },
    "<=5.0": {
        "*": [
            "ts5.0/*"
        ]
    },
    "<=5.2": {
        "*": [
            "ts5.2/*"
        ]
    }
}`,
    );
  });
});

describe(getLicenseFromPackageJson.name, () => {
  it("returns MIT by default", () => {
    assert.equal(getLicenseFromPackageJson(undefined), License.MIT);
  });

  it("throws if license is MIT", () => {
    assert.deepEqual(getLicenseFromPackageJson("MIT"), [
      'Specifying \'"license": "MIT"\' is redundant, this is the default.',
    ]);
  });

  it("returns known licenses", () => {
    assert.equal(getLicenseFromPackageJson(License.Apache20), License.Apache20);
  });

  it("throws if unknown license", () => {
    assert.deepEqual(getLicenseFromPackageJson("nonsense"), [
      `'package.json' license is "nonsense".
Expected one of: ["MIT","Apache-2.0"]}`,
    ]);
  });
});
