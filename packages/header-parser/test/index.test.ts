import { validatePackageJson, makeTypesVersionsForPackageJson } from "../src";

describe("validatePackageJson", () => {
  const pkgJson: Record<string, unknown> = {
    "private": true,
    "name": "@types/hapi",
    "version": "18.0.0",
    "projects": [
      "https://github.com/hapijs/hapi",
      "https://hapijs.com"
    ],
    "typeScriptVersion": "4.2",
    "dependencies": {
      "@types/boom": "*",
      "@types/catbox": "*",
      "@types/iron": "*",
      "@types/mimos": "*",
      "@types/node": "*",
      "@types/podium": "*",
      "@types/shot": "*",
      "joi": "^17.3.0"
    },
    "devDependencies": {
      "@types/hapi": "workspace:."
    },
    "contributors": [
      {
        "name": "Rafael Souza Fijalkowski",
        "githubUsername": "rafaelsouzaf"
      },
      {
        "name": "Justin Simms",
        "url": "https://example.com/jhsimms",
      },
      {
        "name": "Simon Schick",
        "githubUsername": "SimonSchick"
      },
      {
        "name": "Rodrigo Saboya",
        "githubUsername": "saboya"
      }
    ]
  };
  it("requires private: true", () => {
    const pkg = { ...pkgJson };
    delete pkg.private;
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", pkg, [])).toEqual([
      `cort-start/hapi/package.json has bad "private": must be \`"private": true\``
    ]);
  });
  it("requires name", () => {
    const pkg = { ...pkgJson };
    delete pkg.name;
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", pkg, [])).toEqual([
      "cort-start/hapi/package.json should have `\"name\": \"@types/hapi\"`"
    ]);
  });
  it("requires name to match", () => {
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", { ...pkgJson, name: "@types/sad" }, [])).toEqual([
      "cort-start/hapi/package.json should have `\"name\": \"@types/hapi\"`"
    ]);
  });
  it("requires devDependencies", () => {
    const pkg = { ...pkgJson };
    delete pkg.devDependencies;
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", pkg, [])).toEqual([
      `cort-start/hapi/package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``
    ]);
  });
  it("requires devDependencies to contain self-package", () => {
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", { ...pkgJson, devDependencies: { } }, [])).toEqual([
      `cort-start/hapi/package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``
    ]);
  });
  it("requires devDependencies to contain self-package version 'workspace:.'", () => {
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", { ...pkgJson, devDependencies: { "@types/hapi": "*" } }, [])).toEqual([
      `cort-start/hapi/package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``
    ]);
  });
  it("requires version", () => {
    const pkg = { ...pkgJson };
    delete pkg.version;
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", pkg, [])).toEqual([
      `cort-start/hapi/package.json should have \`"version"\` matching the version of the implementation package.`
    ]);
  });
  it("requires version to be NN.NN.NN", () => {
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", { ...pkgJson, version: "hi there" }, [])).toEqual([
      `cort-start/hapi/package.json has bad "version": should look like "NN.NN.0"`
    ]);
  });
  it("requires version to end with .0", () => {
    expect(validatePackageJson("hapi", "cort-start/hapi/package.json", { ...pkgJson, version: "1.2.3" }, [])).toEqual([
      `cort-start/hapi/package.json has bad "version": must end with ".0"`
    ]);
  });
  it("works with old-version packages", () => {
    expect(Array.isArray(validatePackageJson("hapi", "cort-start/hapi/package.json", { ...pkgJson, version: "16.6.0" }, []))).toBeFalsy();
  })
})
describe("makeTypesVersionsForPackageJson", () => {
  it("is undefined for empty versions", () => {
    expect(makeTypesVersionsForPackageJson([])).toBeUndefined();
  });
  it("works for one version", () => {
    expect(makeTypesVersionsForPackageJson(["4.3"])).toEqual({
      "<=4.3": {
        "*": ["ts4.3/*"],
      },
    });
  });
  it("orders versions old to new  with old-to-new input", () => {
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["4.4", "4.8", "5.0"]), undefined, 4)).toEqual(`{
    "<=4.4": {
        "*": [
            "ts4.4/*"
        ]
    },
    "<=4.8": {
        "*": [
            "ts4.8/*"
        ]
    },
    "<=5.0": {
        "*": [
            "ts5.0/*"
        ]
    }
}`);
  });
  it("orders versions old to new  with new-to-old input", () => {
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["5.0", "4.8", "4.4"]), undefined, 4)).toEqual(`{
    "<=4.4": {
        "*": [
            "ts4.4/*"
        ]
    },
    "<=4.8": {
        "*": [
            "ts4.8/*"
        ]
    },
    "<=5.0": {
        "*": [
            "ts5.0/*"
        ]
    }
}`);
  });
});
