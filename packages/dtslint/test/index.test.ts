/// <reference types="jest" />
import { join } from "path";
import { consoleTestResultHandler, runTest } from "tslint/lib/test";
import { existsSync, readdirSync, statSync } from "fs";
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";
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
    private: true,
    name: "@types/hapi",
    version: "18.0.0",
    projects: ["https://github.com/hapijs/hapi", "https://hapijs.com"],
    typeScriptVersion: "4.2",
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
    contributors: [
      {
        name: "Rafael Souza Fijalkowski",
        githubUsername: "rafaelsouzaf",
      },
      {
        name: "Justin Simms",
        githubUsername: "jhsimms",
      },
      {
        name: "Simon Schick",
        githubUsername: "SimonSchick",
      },
      {
        name: "Rodrigo Saboya",
        url: "https://example.com/saboya",
      },
    ],
  };
  describe("checks", () => {
    describe("checkTsconfig", () => {
      it("disallows unknown compiler options", () => {
        expect(checkTsconfig({ ...base, completelyInvented: true })).toEqual([
          "Unexpected compiler option completelyInvented",
        ]);
      });
      it("allows exactOptionalPropertyTypes: true", () => {
        expect(checkTsconfig({ ...base, exactOptionalPropertyTypes: true })).toEqual([]);
      });
      it("allows module: node16", () => {
        expect(checkTsconfig({ ...base, module: "node16" })).toEqual([]);
      });
      it("disallows missing `module`", () => {
        const options = { ...base };
        delete options.module;
        expect(checkTsconfig(options)).toEqual([
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.',
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        expect(checkTsconfig({ ...base, exactOptionalPropertyTypes: false })).toEqual([
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.',
        ]);
      });
      it("disallows `paths`", () => {
        expect(checkTsconfig({ ...base, paths: { c: ["."] } })).toEqual(["Unexpected compiler option paths"]);
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
