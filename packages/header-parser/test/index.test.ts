import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { validatePackageJson, makeTypesVersionsForPackageJson } from "../src";

describe("validatePackageJson", () => {
  const pkgJson: Record<string, unknown> = {
    "private": true,
    "name": "@types/hapi",
    "version": "18.0.99999",
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
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      `hapi's package.json has bad "private": must be \`"private": true\``
    ]);
  });
  it("requires name", () => {
    const pkg = { ...pkgJson };
    delete pkg.name;
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      "hapi's package.json should have `\"name\": \"@types/hapi\"`"
    ]);
  });
  it("requires name to match", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, name: "@types/sad" }, [])).toEqual([
      "hapi's package.json should have `\"name\": \"@types/hapi\"`"
    ]);
  });
  it("requires devDependencies", () => {
    const pkg = { ...pkgJson };
    delete pkg.devDependencies;
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``
    ]);
  });
  it("requires devDependencies to contain self-package", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, devDependencies: { } }, [])).toEqual([
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``
    ]);
  });
  it("requires devDependencies to contain self-package version 'workspace:.'", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, devDependencies: { "@types/hapi": "*" } }, [])).toEqual([
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``
    ]);
  });
  it("requires version", () => {
    const pkg = { ...pkgJson };
    delete pkg.version;
    expect(validatePackageJson("hapi", pkg, [])).toEqual([
      `hapi's package.json should have \`"version"\` matching the version of the implementation package.`
    ]);
  });
  it("requires version to be NN.NN.NN", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, version: "hi there" }, [])).toEqual([
      `hapi's package.json has bad "version": should look like "NN.NN.99999"`
    ]);
  });
  it("requires version to end with .99999", () => {
    expect(validatePackageJson("hapi", { ...pkgJson, version: "1.2.3" }, [])).toEqual([
      `hapi's package.json has bad "version": must end with ".99999"`
    ]);
  });
  it("works with old-version packages", () => {
    expect(Array.isArray(validatePackageJson("hapi", { ...pkgJson, version: "16.6.99999" }, []))).toBeFalsy();
  })
});

describe("isSupported", () => {
  it("works", () => {
    expect(TypeScriptVersion.isSupported("5.0")).toBeTruthy();
  });
  it("supports oldest", () => {
    expect(TypeScriptVersion.isSupported("4.5")).toBeTruthy();
  });
  it("does not support just before oldest", () => {
    expect(!TypeScriptVersion.isSupported("4.4")).toBeTruthy();
  });
});

describe("isTypeScriptVersion", () => {
  it("accepts in-range", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("5.0")).toBeTruthy();
  });
  it("rejects out-of-range", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("101.1")).toBeFalsy();
  });
  it("rejects garbage", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("it'sa me, luigi")).toBeFalsy();
  });
});

describe("range", () => {
  it("works", () => {
    expect(TypeScriptVersion.range("4.9")).toEqual(["4.9", "5.0", "5.1", "5.2", "5.3"]);
  });
  it("includes oldest and above", () => {
    expect(TypeScriptVersion.range("4.5")).toEqual(TypeScriptVersion.supported);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    expect(TypeScriptVersion.tagsToUpdate("5.0")).toEqual(["ts5.0", "ts5.1", "ts5.2", "ts5.3", "latest"]);
  });
  it("allows 4.5 onwards", () => {
    expect(TypeScriptVersion.tagsToUpdate("4.5")).toEqual(
      TypeScriptVersion.supported.map((s) => "ts" + s).concat("latest")
    );
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
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["4.7", "5.0", "5.2"]), undefined, 4)).toEqual(`{
    "<=4.7": {
        "*": [
            "ts4.7/*"
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
    expect(JSON.stringify(makeTypesVersionsForPackageJson(["5.2", "5.0", "4.7"]), undefined, 4)).toEqual(`{
    "<=4.7": {
        "*": [
            "ts4.7/*"
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
