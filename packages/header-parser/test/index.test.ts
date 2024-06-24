import { validatePackageJson, makeTypesVersionsForPackageJson, License, getLicenseFromPackageJson } from "../src";

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
