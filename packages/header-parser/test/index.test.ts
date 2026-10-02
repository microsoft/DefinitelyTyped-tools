import {
  validatePackageJson,
  makeTypesVersionsForPackageJson,
  License,
  getLicenseFromPackageJson,
  checkPackageJsonExportsAndAddPJsonEntry,
  checkPackageJsonImports,
  checkPackageJsonType,
  checkPackageJsonDependencies,
} from "../src";

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
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      `hapi's package.json has bad "private": must be \`"private": true\``,
    ]);
  });
  it("requires name", () => {
    const pkg = { ...pkgJson };
    delete pkg.name;
    expect(validatePackageJson("hapi", pkg, [])).toEqual(['hapi\'s package.json should have `"name": "@types/hapi"`']);
  });
  it("requires name to match", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, name: "@types/sad" }, [])).toEqual([
      'hapi\'s package.json should have `"name": "@types/hapi"`',
    ]);
  });
  it("requires devDependencies", () => {
    const pkg = { ...pkgJson };
    delete pkg.devDependencies;
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires devDependencies to contain self-package", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, devDependencies: {} }, [])).toEqual([
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires devDependencies to contain self-package version 'workspace:.'", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, devDependencies: { "@types/hapi": "*" } }, [])).toEqual([
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires version", () => {
    const pkg = { ...pkgJson };
    delete pkg.version;
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      `hapi's package.json should have \`"version"\` matching the version of the implementation package.`,
    ]);
  });
  it("requires version to be NN.NN.NN", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, version: "hi there" }, [])).toEqual([
      `hapi's package.json has bad "version": "hi there" should look like "NN.NN.9999"`,
    ]);
  });
  it("requires version to end with .9999", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, version: "1.2.3" }, [])).toEqual([
      `hapi's package.json has bad "version": 1.2.3 must end with ".9999"`,
    ]);
  });
  it("works with old-version packages", () => {
    expect(Array.isArray(validatePackageJson("hapi", { ...pkgJson, version: "16.6.9999" }, []))).toBeFalsy();
  });
  it("requires dependency versions to be valid semver ranges, dist-tags, or 'workspace:.'", () => {
    expect(
      validatePackageJson(
        "hapi",
        { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: "not a range" } },
        [],
      ),
    ).toEqual([
      `hapi's package.json has bad "dependencies": version for joi ("not a range") must be a valid semver range, dist-tag, or "workspace:.".`,
    ]);
  });
  it.each([
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
  ])("rejects non-registry dependency spec %p", (bad) => {
    const result = validatePackageJson(
      "hapi",
      { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: bad } },
      [],
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result as string[]).toContainEqual(
      `hapi's package.json has bad "dependencies": version for joi (${JSON.stringify(
        bad,
      )}) must be a valid semver range, dist-tag, or "workspace:.".`,
    );
  });
  it.each([["latest"], ["next"], ["beta"], ["rc"], ["canary"], ["experimental"], ["nightly"]])(
    "allows dist-tag %p as a dependency version",
    (tag) => {
      expect(
        Array.isArray(
          validatePackageJson(
            "hapi",
            { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: tag } },
            [],
          ),
        ),
      ).toBeFalsy();
    },
  );
  it("allows 'workspace:.' as a dependency version", () => {
    expect(
      Array.isArray(
        validatePackageJson(
          "hapi",
          { ...pkgJson, dependencies: { ...(pkgJson.dependencies as object), joi: "workspace:." } },
          [],
        ),
      ),
    ).toBeFalsy();
  });
  it("requires dependency versions to be strings", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, peerDependencies: { foo: 5 } }, [])).toEqual([
      `hapi's package.json has bad "peerDependencies": version for foo should be a string.`,
    ]);
  });
});

describe("makeTypesVersionsForPackageJson", () => {
  it("is undefined for empty versions", () => {
    expect(makeTypesVersionsForPackageJson([])).toBeUndefined();
  });
  it("works for one version", () => {
    expect(makeTypesVersionsForPackageJson(["4.5"])).toEqual({
      "<=4.5": {
        "*": ["ts4.5/*"],
      },
    });
  });
  it("orders versions old to new  with old-to-new input", () => {
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["4.8", "5.0", "5.2"]), undefined, 4)).toEqual(`{
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
}`);
  });
  it("orders versions old to new  with new-to-old input", () => {
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["5.2", "5.0", "4.8"]), undefined, 4)).toEqual(`{
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
}`);
  });
});

describe(getLicenseFromPackageJson, () => {
  it("returns MIT by default", () => {
    expect(getLicenseFromPackageJson(undefined)).toBe(License.MIT);
  });

  it("throws if license is MIT", () => {
    expect(getLicenseFromPackageJson("MIT")).toEqual([
      'Specifying \'"license": "MIT"\' is redundant, this is the default.',
    ]);
  });

  it("returns known licenses", () => {
    expect(getLicenseFromPackageJson(License.Apache20)).toBe(License.Apache20);
  });

  it("throws if unknown license", () => {
    expect(getLicenseFromPackageJson("nonsense")).toEqual([
      `'package.json' license is "nonsense".
Expected one of: ["MIT","Apache-2.0"]}`,
    ]);
  });
});

describe("validatePackageJson - additional coverage", () => {
  const validPkg: Record<string, unknown> = {
    private: true,
    name: "@types/mylib",
    version: "2.0.9999",
    projects: ["https://github.com/example/mylib"],
    owners: [{ name: "Test User", githubUsername: "testuser" }],
    devDependencies: { "@types/mylib": "workspace:." },
  };

  it("returns a valid header for a correct package.json", () => {
    const result = validatePackageJson("mylib", validPkg, []);
    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual({
      name: "@types/mylib",
      libraryMajorVersion: 2,
      libraryMinorVersion: 0,
      nonNpm: false,
      minimumTypeScriptVersion: "5.3",
      projects: ["https://github.com/example/mylib"],
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      tsconfigs: ["tsconfig.json"],
    });
  });

  it("rejects unknown top-level properties", () => {
    const result = validatePackageJson("mylib", { ...validPkg, unknownProp: "bad" }, []);
    expect(result).toEqual(expect.arrayContaining(["mylib's package.json should not include property unknownProp"]));
  });

  it("allows known optional keys without error", () => {
    const pkg = {
      ...validPkg,
      license: "Apache-2.0",
      imports: {},
      exports: {},
      type: "module",
      peerDependencies: {},
      pnpm: {},
    };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
  });

  // nonNpm validation
  it("accepts nonNpm: true with nonNpmDescription", () => {
    const pkg = { ...validPkg, nonNpm: true, nonNpmDescription: "Built-in Node API" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).nonNpm).toBe(true);
  });

  it("accepts nonNpm: 'conflict' with nonNpmDescription", () => {
    const pkg = { ...validPkg, nonNpm: "conflict", nonNpmDescription: "Conflicts with npm package" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).nonNpm).toBe("conflict");
  });

  it("rejects nonNpm with invalid value", () => {
    const pkg = { ...validPkg, nonNpm: "invalid" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([`mylib's package.json has bad "nonNpm": must be true or "conflict" if present.`]),
    );
  });

  it("rejects nonNpm: true without nonNpmDescription", () => {
    const pkg = { ...validPkg, nonNpm: true };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([
        `mylib's package.json has missing "nonNpmDescription", which is required with "nonNpm": true.`,
      ]),
    );
  });

  it("rejects nonNpm: true with non-string nonNpmDescription", () => {
    const pkg = { ...validPkg, nonNpm: true, nonNpmDescription: 42 };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([
        `mylib's package.json has bad "nonNpmDescription": must be a string if present.`,
      ]),
    );
  });

  it("rejects nonNpmDescription without nonNpm", () => {
    const pkg = { ...validPkg, nonNpmDescription: "description without nonNpm" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([`mylib's package.json has "nonNpmDescription" without "nonNpm": true.`]),
    );
  });

  // minimumTypeScriptVersion validation
  it("accepts a valid minimumTypeScriptVersion", () => {
    const pkg = { ...validPkg, minimumTypeScriptVersion: "5.5" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).minimumTypeScriptVersion).toBe("5.5");
  });

  it("rejects invalid minimumTypeScriptVersion", () => {
    const pkg = { ...validPkg, minimumTypeScriptVersion: "99.99" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining(`has bad "minimumTypeScriptVersion"`)]),
    );
  });

  it("rejects non-string minimumTypeScriptVersion", () => {
    const pkg = { ...validPkg, minimumTypeScriptVersion: 5 };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining(`has bad "minimumTypeScriptVersion"`)]),
    );
  });

  // projects validation
  it("rejects missing projects", () => {
    const pkg = { ...validPkg };
    delete pkg.projects;
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "projects"`)]));
  });

  it("rejects empty projects array", () => {
    const result = validatePackageJson("mylib", { ...validPkg, projects: [] }, []);
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining("must have at least one project URL")]),
    );
  });

  it("rejects non-array projects", () => {
    const result = validatePackageJson("mylib", { ...validPkg, projects: "https://example.com" }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "projects"`)]));
  });

  it("rejects projects with non-string entries", () => {
    const result = validatePackageJson("mylib", { ...validPkg, projects: [42] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "projects"`)]));
  });

  // owners validation
  it("rejects missing owners", () => {
    const pkg = { ...validPkg };
    delete pkg.owners;
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "owners"`)]));
  });

  it("rejects non-array owners", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: "not array" }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "owners"`)]));
  });

  it("rejects owner with name 'My Self'", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: [{ name: "My Self", githubUsername: "x" }] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining("Author name should be your name")]));
  });

  it("rejects owner without name", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: [{ githubUsername: "x" }] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "name" in owner`)]));
  });

  it("rejects owner with non-string name", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: [{ name: 123, githubUsername: "x" }] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "name" in owner`)]));
  });

  it("rejects owner with both githubUsername and url", () => {
    const result = validatePackageJson(
      "mylib",
      { ...validPkg, owners: [{ name: "Test", githubUsername: "test", url: "https://example.com" }] },
      [],
    );
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining('should not have both "githubUsername" and "url"')]),
    );
  });

  it("rejects owner with non-string githubUsername", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: [{ name: "Test", githubUsername: 42 }] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "githubUsername" in owner`)]));
  });

  it("rejects owner with non-string url", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: [{ name: "Test", url: 42 }] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "url" in owner`)]));
  });

  it("accepts owner with url string", () => {
    const pkg = { ...validPkg, owners: [{ name: "Test", url: "https://example.com" }] };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
  });

  it("rejects owner with extra properties", () => {
    const result = validatePackageJson(
      "mylib",
      { ...validPkg, owners: [{ name: "Test", githubUsername: "test", extra: true }] },
      [],
    );
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining("should not include property extra")]),
    );
  });

  it("rejects non-object owner entry", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: ["not-an-object"] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "owners"`)]));
  });

  it("rejects null owner entry", () => {
    const result = validatePackageJson("mylib", { ...validPkg, owners: [null] }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "owners"`)]));
  });

  // tsconfigs validation
  it("defaults tsconfigs to ['tsconfig.json'] when not specified", () => {
    const result = validatePackageJson("mylib", validPkg, []);
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).tsconfigs).toEqual(["tsconfig.json"]);
  });

  it("accepts valid tsconfigs array", () => {
    const pkg = { ...validPkg, tsconfigs: ["tsconfig.json", "tsconfig.esm.json"] };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).tsconfigs).toEqual(["tsconfig.json", "tsconfig.esm.json"]);
  });

  it("rejects non-array tsconfigs", () => {
    const result = validatePackageJson("mylib", { ...validPkg, tsconfigs: "tsconfig.json" }, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining(`has bad "tsconfigs"`)]));
  });

  // NOTE: The following tests document current behavior. The validateTsconfigs function
  // has a bug where it iterates the outer `tsconfigs` variable instead of `packageJson.tsconfigs`,
  // so individual entry validation is effectively skipped.
  it("accepts tsconfig entries without validating names (known bug)", () => {
    const result = validatePackageJson("mylib", { ...validPkg, tsconfigs: ["badname.json"] }, []);
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).tsconfigs).toEqual(["badname.json"]);
  });

  // typesVersions-related
  it("errors when typesVersions is set but no tsX.X directories exist", () => {
    const result = validatePackageJson("mylib", { ...validPkg, typesVersions: {} }, []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`doesn't need to set "typesVersions"`),
      ]),
    );
  });

  it("errors when types is set but no tsX.X directories exist", () => {
    const result = validatePackageJson("mylib", { ...validPkg, types: "index" }, []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`doesn't need to set "types"`),
      ]),
    );
  });

  it("errors when typesVersions doesn't match expected for given versions", () => {
    const pkg = { ...validPkg, types: "index", typesVersions: { "<=4.0": { "*": ["ts4.0/*"] } } };
    const result = validatePackageJson("mylib", pkg, ["5.4"]);
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining(`has bad "typesVersions"`)]),
    );
  });

  // version edge cases
  it("rejects non-string version", () => {
    const result = validatePackageJson("mylib", { ...validPkg, version: 123 }, []);
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining('should have `"version"`')]),
    );
  });

  // accumulates multiple errors
  it("accumulates multiple errors", () => {
    const pkg = {
      private: false,
      name: "@types/wrong",
      version: "bad",
      owners: "not-array",
      projects: "not-array",
      devDependencies: {},
    };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBeGreaterThan(3);
  });

  // license: Apache-2.0 through validatePackageJson
  it("accepts Apache-2.0 license", () => {
    const pkg = { ...validPkg, license: "Apache-2.0" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(false);
  });

  it("rejects redundant MIT license", () => {
    const pkg = { ...validPkg, license: "MIT" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([expect.stringContaining("redundant")]),
    );
  });

  it("rejects invalid license", () => {
    const pkg = { ...validPkg, license: "GPL-3.0" };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(expect.arrayContaining([expect.stringContaining("license")]));
  });
});

describe("checkPackageJsonExportsAndAddPJsonEntry", () => {
  it("returns undefined when exports is undefined", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(undefined, "/test")).toBeUndefined();
  });

  it("returns string exports as-is", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry("./index.js", "/test")).toBe("./index.js");
  });

  it("returns error for non-object, non-string exports", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(42, "/test")).toEqual([
      "Package exports at path /test should be an object or string.",
    ]);
  });

  it("returns error for null exports", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(null, "/test")).toEqual([
      "Package exports at path /test should not be null.",
    ]);
  });

  it("returns error for boolean exports", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(true, "/test")).toEqual([
      "Package exports at path /test should be an object or string.",
    ]);
  });

  it("adds ./package.json entry when missing", () => {
    const exports = { ".": "./index.js" };
    const result = checkPackageJsonExportsAndAddPJsonEntry(exports, "/test");
    expect(result).toEqual({ ".": "./index.js", "./package.json": "./package.json" });
  });

  it("preserves existing ./package.json entry", () => {
    const exports = { ".": "./index.js", "./package.json": "./custom.json" };
    const result = checkPackageJsonExportsAndAddPJsonEntry(exports, "/test");
    expect(result).toEqual({ ".": "./index.js", "./package.json": "./custom.json" });
  });
});

describe("checkPackageJsonImports", () => {
  it("returns undefined when imports is undefined", () => {
    expect(checkPackageJsonImports(undefined, "/test")).toBeUndefined();
  });

  it("returns error for non-object imports", () => {
    expect(checkPackageJsonImports("string", "/test")).toEqual([
      "Package imports at path /test should be an object or string.",
    ]);
  });

  it("returns error for number imports", () => {
    expect(checkPackageJsonImports(42, "/test")).toEqual([
      "Package imports at path /test should be an object or string.",
    ]);
  });

  it("returns error for null imports", () => {
    expect(checkPackageJsonImports(null, "/test")).toEqual([
      "Package imports at path /test should not be null.",
    ]);
  });

  it("returns valid object imports as-is", () => {
    const imports = { "#utils": "./src/utils.js" };
    expect(checkPackageJsonImports(imports, "/test")).toEqual(imports);
  });
});

describe("checkPackageJsonType", () => {
  it("returns undefined when type is undefined", () => {
    expect(checkPackageJsonType(undefined, "/test")).toBeUndefined();
  });

  it("returns 'module' when type is 'module'", () => {
    expect(checkPackageJsonType("module", "/test")).toBe("module");
  });

  it("rejects 'commonjs' type", () => {
    expect(checkPackageJsonType("commonjs", "/test")).toEqual([
      "Package type at path /test can only be 'module'.",
    ]);
  });

  it("rejects non-string type", () => {
    expect(checkPackageJsonType(42, "/test")).toEqual([
      "Package type at path /test can only be 'module'.",
    ]);
  });
});

describe("checkPackageJsonDependencies", () => {
  const allowed = new Set(["lodash", "express"]);

  it("returns empty array for undefined dependencies", () => {
    expect(checkPackageJsonDependencies(undefined, "/test", allowed)).toEqual([]);
  });

  it("returns error for null dependencies", () => {
    expect(checkPackageJsonDependencies(null, "/test", allowed)).toEqual([
      "/test should contain dependencies or not exist.",
    ]);
  });

  it("returns error for non-object dependencies", () => {
    expect(checkPackageJsonDependencies("bad", "/test", allowed)).toEqual([
      "/test should contain dependencies or not exist.",
    ]);
  });

  it("returns devDependencies label for null when devDependencySelfName provided", () => {
    expect(checkPackageJsonDependencies(null, "/test", allowed, "@types/mylib")).toEqual([
      "/test should contain devDependencies or not exist.",
    ]);
  });

  it("allows @types/ dependencies without being in allowedDependencies", () => {
    expect(checkPackageJsonDependencies({ "@types/node": "*" }, "/test", allowed)).toEqual([]);
  });

  it("allows listed dependencies", () => {
    expect(checkPackageJsonDependencies({ lodash: "^4.0.0" }, "/test", allowed)).toEqual([]);
  });

  it("errors on unlisted non-@types dependencies", () => {
    const result = checkPackageJsonDependencies({ "unknown-pkg": "^1.0.0" }, "/test", allowed);
    expect(result).toEqual([expect.stringContaining("Dependency unknown-pkg not in the allowed dependencies list")]);
  });

  it("errors on non-string version", () => {
    const result = checkPackageJsonDependencies({ lodash: 42 }, "/test", allowed);
    expect(result).toEqual([expect.stringContaining("Dependency version for lodash should be a string")]);
  });

  it("errors when self-reference is missing in devDependencies", () => {
    const result = checkPackageJsonDependencies({ "@types/node": "*" }, "/test", allowed, "@types/mylib");
    expect(result).toEqual([expect.stringContaining("devDependencies must contain a self-reference")]);
  });

  it("errors when self-reference has wrong version in devDependencies", () => {
    const result = checkPackageJsonDependencies({ "@types/mylib": "*" }, "/test", allowed, "@types/mylib");
    expect(result).toEqual([expect.stringContaining("devDependencies must contain a self-reference")]);
  });

  it("passes when self-reference is correct", () => {
    const result = checkPackageJsonDependencies({ "@types/mylib": "workspace:." }, "/test", allowed, "@types/mylib");
    expect(result).toEqual([]);
  });

  it("accumulates multiple errors", () => {
    const deps = { "unknown1": 42, "unknown2": "^1.0.0" };
    const result = checkPackageJsonDependencies(deps, "/test", allowed);
    expect(result.length).toBeGreaterThanOrEqual(3); // 2 unlisted + 1 non-string version
  });
});
