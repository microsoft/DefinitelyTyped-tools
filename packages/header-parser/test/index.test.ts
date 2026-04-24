import {
  validatePackageJson,
  makeTypesVersionsForPackageJson,
  License,
  getLicenseFromPackageJson,
  checkPackageJsonExportsAndAddPJsonEntry,
  checkPackageJsonImports,
  checkPackageJsonType,
  checkPackageJsonDependencies,
  getTypesVersions,
} from "../src";
import * as fs from "fs";

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

describe("validatePackageJson - nonNpm", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      ...overrides,
    };
  }

  it("returns nonNpm: false when nonNpm is absent", () => {
    const result = validatePackageJson("mylib", makePkg(), []);
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).nonNpm).toBe(false);
  });

  it("accepts nonNpm: true with nonNpmDescription", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ nonNpm: true, nonNpmDescription: "This package is built-in." }),
      [],
    );
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).nonNpm).toBe(true);
  });

  it("accepts nonNpm: 'conflict' with nonNpmDescription", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ nonNpm: "conflict", nonNpmDescription: "Conflicts with npm package." }),
      [],
    );
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).nonNpm).toBe("conflict");
  });

  it("rejects nonNpm with invalid value", () => {
    const result = validatePackageJson("mylib", makePkg({ nonNpm: "invalid" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "nonNpm": must be true or "conflict"'),
      ]),
    );
  });

  it("rejects nonNpm: true without nonNpmDescription", () => {
    const result = validatePackageJson("mylib", makePkg({ nonNpm: true }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has missing "nonNpmDescription"'),
      ]),
    );
  });

  it("rejects nonNpm: true with non-string nonNpmDescription", () => {
    const result = validatePackageJson("mylib", makePkg({ nonNpm: true, nonNpmDescription: 123 }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "nonNpmDescription": must be a string'),
      ]),
    );
  });

  it("rejects nonNpmDescription without nonNpm", () => {
    const result = validatePackageJson("mylib", makePkg({ nonNpmDescription: "No npm" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has "nonNpmDescription" without "nonNpm": true'),
      ]),
    );
  });
});

describe("validatePackageJson - minimumTypeScriptVersion", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      ...overrides,
    };
  }

  it("defaults minimumTypeScriptVersion when not provided", () => {
    const pkg = makePkg();
    delete pkg.minimumTypeScriptVersion;
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).minimumTypeScriptVersion).toBe("5.3");
  });

  it("accepts a valid minimumTypeScriptVersion", () => {
    const result = validatePackageJson("mylib", makePkg({ minimumTypeScriptVersion: "5.5" }), []);
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).minimumTypeScriptVersion).toBe("5.5");
  });

  it("rejects invalid minimumTypeScriptVersion", () => {
    const result = validatePackageJson("mylib", makePkg({ minimumTypeScriptVersion: "99.99" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "minimumTypeScriptVersion"'),
      ]),
    );
  });

  it("rejects non-string minimumTypeScriptVersion", () => {
    const result = validatePackageJson("mylib", makePkg({ minimumTypeScriptVersion: 5 }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "minimumTypeScriptVersion"'),
      ]),
    );
  });
});

describe("validatePackageJson - projects", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      projects: ["https://example.com"],
      ...overrides,
    };
  }

  it("rejects missing projects", () => {
    const pkg = makePkg();
    delete pkg.projects;
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "projects"'),
      ]),
    );
  });

  it("rejects non-array projects", () => {
    const result = validatePackageJson("mylib", makePkg({ projects: "https://example.com" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "projects"'),
      ]),
    );
  });

  it("rejects empty projects array", () => {
    const result = validatePackageJson("mylib", makePkg({ projects: [] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("must have at least one project URL"),
      ]),
    );
  });

  it("rejects projects with non-string entries", () => {
    const result = validatePackageJson("mylib", makePkg({ projects: [123] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "projects"'),
      ]),
    );
  });
});

describe("validatePackageJson - owners", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      ...overrides,
    };
  }

  it("rejects missing owners", () => {
    const pkg = makePkg();
    delete pkg.owners;
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "owners"'),
      ]),
    );
  });

  it("rejects non-array owners", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: "me" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "owners"'),
      ]),
    );
  });

  it("rejects non-object entries in owners", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: ["string-owner"] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "owners"'),
      ]),
    );
  });

  it("rejects null entries in owners", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: [null] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "owners"'),
      ]),
    );
  });

  it("rejects owners missing name", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: [{ githubUsername: "test" }] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "name" in owner'),
      ]),
    );
  });

  it("rejects owners with non-string name", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: [{ name: 123, githubUsername: "test" }] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "name" in owner'),
      ]),
    );
  });

  it("rejects owners with default name 'My Self'", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: [{ name: "My Self", githubUsername: "test" }] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Author name should be your name, not the default"),
      ]),
    );
  });

  it("rejects owners with non-string githubUsername", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: [{ name: "Test", githubUsername: 123 }] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "githubUsername" in owner'),
      ]),
    );
  });

  it("rejects owners with both githubUsername and url", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ owners: [{ name: "Test", githubUsername: "test", url: "https://example.com" }] }),
      [],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('should not have both "githubUsername" and "url"'),
      ]),
    );
  });

  it("rejects owners with non-string url", () => {
    const result = validatePackageJson("mylib", makePkg({ owners: [{ name: "Test", url: 123 }] }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "url" in owner'),
      ]),
    );
  });

  it("rejects owners with extra properties", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ owners: [{ name: "Test", githubUsername: "test", email: "test@test.com" }] }),
      [],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("should not include property email"),
      ]),
    );
  });

  it("accepts owners with url form", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ owners: [{ name: "Test User", url: "https://example.com" }] }),
      [],
    );
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).owners).toEqual([{ name: "Test User", url: "https://example.com" }]);
  });
});

describe("validatePackageJson - tsconfigs", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      ...overrides,
    };
  }

  it("defaults to ['tsconfig.json'] when tsconfigs is absent", () => {
    const result = validatePackageJson("mylib", makePkg(), []);
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).tsconfigs).toEqual(["tsconfig.json"]);
  });

  it("accepts valid tsconfigs", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ tsconfigs: ["tsconfig.json", "tsconfig.esm.json"] }),
      [],
    );
    expect(result).not.toBeInstanceOf(Array);
    expect((result as any).tsconfigs).toEqual(["tsconfig.json", "tsconfig.esm.json"]);
  });

  it("rejects non-array tsconfigs", () => {
    const result = validatePackageJson("mylib", makePkg({ tsconfigs: "tsconfig.json" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "tsconfigs"'),
      ]),
    );
  });

  it("does not validate tsconfig naming (iterates empty local variable)", () => {
    // Same pre-existing bug: line 309 iterates empty local `tsconfigs`, not `packageJson.tsconfigs`
    const result = validatePackageJson("mylib", makePkg({ tsconfigs: ["badname.json"] }), []);
    expect(result).not.toBeInstanceOf(Array);
  });

  it("accepts tsconfigs with non-string entries (note: validation iterates local variable, not packageJson)", () => {
    // Due to a pre-existing bug (line 309 iterates `tsconfigs` local var, not `packageJson.tsconfigs`),
    // non-string entries are not caught. This test documents the current behavior.
    const result = validatePackageJson("mylib", makePkg({ tsconfigs: [123] }), []);
    expect(result).not.toBeInstanceOf(Array);
  });
});

describe("validatePackageJson - unknown properties and typesVersions", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      ...overrides,
    };
  }

  it("rejects unknown properties", () => {
    const result = validatePackageJson("mylib", makePkg({ unknownField: true }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("should not include property unknownField"),
      ]),
    );
  });

  it("rejects typesVersions when no tsX.X directories exist", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({ typesVersions: { "<=5.0": { "*": ["ts5.0/*"] } } }),
      [],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`doesn't need to set "typesVersions"`),
      ]),
    );
  });

  it("rejects types when no tsX.X directories exist", () => {
    const result = validatePackageJson("mylib", makePkg({ types: "index" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`doesn't need to set "types"`),
      ]),
    );
  });

  it("accepts typesVersions when tsX.X directories exist and values match", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({
        types: "index",
        typesVersions: { "<=5.0": { "*": ["ts5.0/*"] } },
      }),
      ["5.0"],
    );
    expect(result).not.toBeInstanceOf(Array);
  });

  it("rejects bad typesVersions value when tsX.X directories exist", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({
        types: "index",
        typesVersions: { "<=99.0": { "*": ["ts99.0/*"] } },
      }),
      ["5.0"],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has bad "typesVersions"'),
      ]),
    );
  });

  it("allows known optional keys without errors", () => {
    const result = validatePackageJson(
      "mylib",
      makePkg({
        license: "Apache-2.0",
        imports: { "#internal": "./src/internal.js" },
        exports: { ".": "./index.js" },
        type: "module",
        peerDependencies: {},
        pnpm: {},
      }),
      [],
    );
    expect(result).not.toBeInstanceOf(Array);
  });
});

describe("validatePackageJson - license integration", () => {
  function makePkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      private: true,
      name: "@types/mylib",
      version: "1.0.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      ...overrides,
    };
  }

  it("reports license error when explicitly set to MIT", () => {
    const result = validatePackageJson("mylib", makePkg({ license: "MIT" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("redundant"),
      ]),
    );
  });

  it("reports license error for unknown license", () => {
    const result = validatePackageJson("mylib", makePkg({ license: "GPL-3.0" }), []);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Expected one of"),
      ]),
    );
  });
});

describe("validatePackageJson - full valid header return", () => {
  it("returns a complete Header object on valid input", () => {
    const pkg: Record<string, unknown> = {
      private: true,
      name: "@types/mylib",
      version: "2.5.9999",
      projects: ["https://example.com"],
      devDependencies: { "@types/mylib": "workspace:." },
      owners: [{ name: "Test User", githubUsername: "testuser" }],
    };
    const result = validatePackageJson("mylib", pkg, []);
    expect(result).toEqual({
      name: "@types/mylib",
      libraryMajorVersion: 2,
      libraryMinorVersion: 5,
      nonNpm: false,
      minimumTypeScriptVersion: "5.3",
      projects: ["https://example.com"],
      owners: [{ name: "Test User", githubUsername: "testuser" }],
      tsconfigs: ["tsconfig.json"],
    });
  });

  it("accumulates multiple errors", () => {
    const pkg: Record<string, unknown> = {
      unknownField: true,
    };
    const result = validatePackageJson("mylib", pkg, []);
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBeGreaterThan(1);
  });
});

describe("checkPackageJsonExportsAndAddPJsonEntry", () => {
  it("returns undefined for undefined exports", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(undefined, "test")).toBeUndefined();
  });

  it("returns string exports as-is", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry("./index.js", "test")).toBe("./index.js");
  });

  it("returns error for non-object non-string exports", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(123, "test")).toEqual([
      "Package exports at path test should be an object or string.",
    ]);
  });

  it("returns error for null exports", () => {
    expect(checkPackageJsonExportsAndAddPJsonEntry(null, "test")).toEqual([
      "Package exports at path test should not be null.",
    ]);
  });

  it("adds ./package.json entry to exports object if missing", () => {
    const exports = { ".": "./index.js" };
    const result = checkPackageJsonExportsAndAddPJsonEntry(exports, "test");
    expect(result).toEqual({ ".": "./index.js", "./package.json": "./package.json" });
  });

  it("does not overwrite existing ./package.json entry", () => {
    const exports = { ".": "./index.js", "./package.json": "./custom-package.json" };
    const result = checkPackageJsonExportsAndAddPJsonEntry(exports, "test");
    expect(result).toEqual({ ".": "./index.js", "./package.json": "./custom-package.json" });
  });
});

describe("checkPackageJsonImports", () => {
  it("returns undefined for undefined imports", () => {
    expect(checkPackageJsonImports(undefined, "test")).toBeUndefined();
  });

  it("returns error for non-object imports", () => {
    expect(checkPackageJsonImports("string", "test")).toEqual([
      "Package imports at path test should be an object or string.",
    ]);
  });

  it("returns error for null imports", () => {
    expect(checkPackageJsonImports(null, "test")).toEqual([
      "Package imports at path test should not be null.",
    ]);
  });

  it("returns object imports as-is", () => {
    const imports = { "#internal": "./src/internal.js" };
    expect(checkPackageJsonImports(imports, "test")).toBe(imports);
  });

  it("returns error for number imports", () => {
    expect(checkPackageJsonImports(42, "test")).toEqual([
      "Package imports at path test should be an object or string.",
    ]);
  });
});

describe("checkPackageJsonType", () => {
  it("returns undefined for undefined type", () => {
    expect(checkPackageJsonType(undefined, "test")).toBeUndefined();
  });

  it("returns 'module' for valid type", () => {
    expect(checkPackageJsonType("module", "test")).toBe("module");
  });

  it("returns error for 'commonjs' type", () => {
    expect(checkPackageJsonType("commonjs", "test")).toEqual([
      "Package type at path test can only be 'module'.",
    ]);
  });

  it("returns error for non-string type", () => {
    expect(checkPackageJsonType(123, "test")).toEqual([
      "Package type at path test can only be 'module'.",
    ]);
  });
});

describe("checkPackageJsonDependencies", () => {
  const allowed = new Set(["allowed-pkg", "another-allowed"]);

  it("returns empty array for undefined dependencies", () => {
    expect(checkPackageJsonDependencies(undefined, "test/path", allowed)).toEqual([]);
  });

  it("returns error for null dependencies", () => {
    expect(checkPackageJsonDependencies(null, "test/path", allowed)).toEqual([
      "test/path should contain dependencies or not exist.",
    ]);
  });

  it("returns error for non-object dependencies", () => {
    expect(checkPackageJsonDependencies("not-an-object", "test/path", allowed)).toEqual([
      "test/path should contain dependencies or not exist.",
    ]);
  });

  it("returns devDependencies in error message when devDependencySelfName is provided", () => {
    expect(checkPackageJsonDependencies(null, "test/path", allowed, "@types/mylib")).toEqual([
      "test/path should contain devDependencies or not exist.",
    ]);
  });

  it("allows @types/ dependencies", () => {
    const deps = { "@types/node": "*" };
    expect(checkPackageJsonDependencies(deps, "test/path", allowed)).toEqual([]);
  });

  it("allows dependencies in the allowed set", () => {
    const deps = { "allowed-pkg": "^1.0.0" };
    expect(checkPackageJsonDependencies(deps, "test/path", allowed)).toEqual([]);
  });

  it("rejects dependencies not in the allowed set", () => {
    const deps = { "not-allowed": "^1.0.0" };
    const result = checkPackageJsonDependencies(deps, "test/path", allowed);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Dependency not-allowed not in the allowed dependencies list"),
      ]),
    );
  });

  it("rejects non-string dependency versions", () => {
    const deps = { "@types/node": 123 };
    const result = checkPackageJsonDependencies(deps, "test/path", allowed);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Dependency version for @types/node should be a string"),
      ]),
    );
  });

  it("requires self-reference in devDependencies when devDependencySelfName is provided", () => {
    const deps = { "@types/other": "*" };
    const result = checkPackageJsonDependencies(deps, "test/path", allowed, "@types/mylib");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('devDependencies must contain a self-reference'),
      ]),
    );
  });

  it("requires self-reference to be 'workspace:.'", () => {
    const deps = { "@types/mylib": "*" };
    const result = checkPackageJsonDependencies(deps, "test/path", allowed, "@types/mylib");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('devDependencies must contain a self-reference'),
      ]),
    );
  });

  it("accepts correct self-reference in devDependencies", () => {
    const deps = { "@types/mylib": "workspace:." };
    const result = checkPackageJsonDependencies(deps, "test/path", allowed, "@types/mylib");
    expect(result).toEqual([]);
  });

  it("reports multiple errors at once", () => {
    const deps = { "not-allowed": 123 };
    const result = checkPackageJsonDependencies(deps, "test/path", allowed);
    expect(result.length).toBe(2);
  });
});

describe("getTypesVersions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync("header-parser-test-");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for directory with no ts directories", () => {
    fs.writeFileSync(`${tmpDir}/index.d.ts`, "");
    expect(getTypesVersions(tmpDir)).toEqual([]);
  });

  it("ignores tsconfig.json", () => {
    fs.writeFileSync(`${tmpDir}/tsconfig.json`, "{}");
    expect(getTypesVersions(tmpDir)).toEqual([]);
  });

  it("finds valid ts version directories", () => {
    fs.mkdirSync(`${tmpDir}/ts5.5`);
    const result = getTypesVersions(tmpDir);
    expect(result).toEqual(["5.5"]);
  });

  it("finds multiple ts version directories", () => {
    fs.mkdirSync(`${tmpDir}/ts5.5`);
    fs.mkdirSync(`${tmpDir}/ts5.8`);
    const result = getTypesVersions(tmpDir);
    expect(result).toContain("5.5");
    expect(result).toContain("5.8");
  });

  it("ignores files starting with ts (not directories)", () => {
    fs.writeFileSync(`${tmpDir}/ts5.5`, "not a directory");
    expect(getTypesVersions(tmpDir)).toEqual([]);
  });

  it("throws for invalid TypeScript version directories", () => {
    fs.mkdirSync(`${tmpDir}/ts99.99`);
    expect(() => getTypesVersions(tmpDir)).toThrow("99.99 is not a valid TypeScript version");
  });

  it("ignores non-ts prefixed directories", () => {
    fs.mkdirSync(`${tmpDir}/src`);
    fs.mkdirSync(`${tmpDir}/dist`);
    expect(getTypesVersions(tmpDir)).toEqual([]);
  });
});
