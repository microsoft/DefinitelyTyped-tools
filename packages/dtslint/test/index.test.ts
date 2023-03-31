/// <reference types="jest" />
import { join } from "path";
import { consoleTestResultHandler, runTest } from "tslint/lib/test";
import { existsSync, readdirSync, statSync } from "fs";
import { CompilerOptionsRaw, checkPackageJsonContents, checkTsconfig } from "../src/checks";
import { assertPackageIsNotDeprecated } from "../src/index";

const testDir = __dirname;

class Logger {
  logmsg = "";
  errormsg = "";
  log(message: string): void {
    this.logmsg += message;
  }
  error(message: string): void {
    this.errormsg += message;
  }
}

function testSingle(testDirectory: string) {
  test(testDirectory, () => {
    const logger = new Logger();
    const result = consoleTestResultHandler(runTest(testDirectory), logger);
    if (!result) {
      console.log(logger.logmsg + logger.errormsg);
    }
    expect(result).toBeTruthy();
  });
}

describe("dtslint", () => {
  const base: CompilerOptionsRaw = {
    module: "commonjs",
    lib: ["es6"],
    noImplicitAny: true,
    noImplicitThis: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    types: [],
    noEmit: true,
    forceConsistentCasingInFileNames: true,
  };
  const pkgJson: Record<string, unknown> = {
    "private": true,
    "name": "@types/hapi",
    "version": "18.0.0",
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
    }
  }
  describe("checks", () => {
    describe("checkTsconfig", () => {
      it("disallows unknown compiler options", () => {
        expect(checkTsconfig({ ...base, completelyInvented: true }, true)).toEqual([
          "Unexpected compiler option completelyInvented"
        ]);
      });
      it("allows exactOptionalPropertyTypes: true", () => {
        expect(checkTsconfig({ ...base, exactOptionalPropertyTypes: true }, true)).toEqual([]);
      });
      it("allows module: node16", () => {
        expect(checkTsconfig({ ...base, module: "node16" }, true)).toEqual([]);
      });
      it("disallows missing `module`", () => {
        const options = { ...base };
        delete options.module;
        expect(checkTsconfig(options, true)).toEqual([
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.'
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        expect(checkTsconfig({ ...base, exactOptionalPropertyTypes: false }, true)).toEqual([
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.'
        ]);
      });
      it("disallows `paths`", () => {
        expect(checkTsconfig({ ...base, paths: { "c": ['.'] } }, true)).toEqual([
          'Unexpected compiler option paths'
        ]);
      });
    });
    describe("checkPackageJson", () => {
      it("requires private: true", () => {
        const pkg = { ...pkgJson };
        delete pkg.private;
        expect(checkPackageJsonContents("cort-start/hapi", pkg, [])).toEqual([
          "cort-start/hapi/package.json should have `\"private\": true`"
        ]);
      });
      it("requires name", () => {
        const pkg = { ...pkgJson };
        delete pkg.name;
        expect(checkPackageJsonContents("cort-start/hapi", pkg, [])).toEqual([
          "cort-start/hapi/package.json should have `\"name\": \"@types/hapi\"`"
        ]);
      });
      it("requires name to match", () => {
        expect(checkPackageJsonContents("cort-start/hapi", { ...pkgJson, name: "@types/sad" }, [])).toEqual([
          "cort-start/hapi/package.json should have `\"name\": \"@types/hapi\"`"
        ]);
      });
      it("requires devDependencies", () => {
        const pkg = { ...pkgJson };
        delete pkg.devDependencies;
        expect(checkPackageJsonContents("cort-start/hapi", pkg, [])).toEqual([
          `In cort-start/hapi/package.json, devDependencies must include \`"@types/hapi": "workspace:."\``
        ]);
      });
      it("requires devDependencies to contain self-package", () => {
        expect(checkPackageJsonContents("cort-start/hapi", { ...pkgJson, devDependencies: { } }, [])).toEqual([
          `In cort-start/hapi/package.json, devDependencies must include \`"@types/hapi": "workspace:."\``
        ]);
      });
      it("requires devDependencies to contain self-package version 'workspace:.'", () => {
        expect(checkPackageJsonContents("cort-start/hapi", { ...pkgJson, devDependencies: { "@types/hapi": "*" } }, [])).toEqual([
          `In cort-start/hapi/package.json, devDependencies must include \`"@types/hapi": "workspace:."\``
        ]);
      });
      it("requires version", () => {
        const pkg = { ...pkgJson };
        delete pkg.version;
        expect(checkPackageJsonContents("cort-start/hapi", pkg, [])).toEqual([
          `cort-start/hapi/package.json should have \`"version"\` matching the version of the implementation package.`
        ]);
      });
      it("requires version to be NN.NN.NN", () => {
        expect(checkPackageJsonContents("cort-start/hapi", { ...pkgJson, version: "hi there" }, [])).toEqual([
          `cort-start/hapi/package.json has bad "version": should look like "NN.NN.0"`
        ]);
      });
      it("requires version to end with .0", () => {
        expect(checkPackageJsonContents("cort-start/hapi", { ...pkgJson, version: "1.2.3" }, [])).toEqual([
          `cort-start/hapi/package.json has bad "version": must end with ".0"`
        ]);
      });
      it("works with old-version packages", () => {
        expect(checkPackageJsonContents("cort-start/hapi/v16", { ...pkgJson, version: "16.6.0" }, [])).toEqual([])
      });
    });
    describe("assertPackageIsNotDeprecated", () => {
      it("disallows packages that are in notNeededPackages.json", () => {
        expect(() => assertPackageIsNotDeprecated("foo", '{ "packages": { "foo": { } } }')).toThrow(
          "notNeededPackages.json has an entry for foo."
        );
      });
      it("allows packages that are not in notNeededPackages.json", () => {
        expect(assertPackageIsNotDeprecated("foo", '{ "packages": { "bar": { } } }')).toBeUndefined();
      });
    });
  });
  describe("rules", () => {
    const tests = readdirSync(testDir);
    for (const testName of tests) {
      const testDirectory = join(testDir, testName);
      if (existsSync(join(testDirectory, "tslint.json"))) {
        testSingle(testDirectory);
      } else if (statSync(testDirectory).isDirectory()) {
        for (const subTestName of readdirSync(testDirectory)) {
          testSingle(join(testDirectory, subTestName));
        }
      }
    }
  });
});
