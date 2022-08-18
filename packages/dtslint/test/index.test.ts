/// <reference types="jest" />
import { join } from "path";
import { consoleTestResultHandler, runTest } from "tslint/lib/test";
import { existsSync, readdirSync, statSync } from "fs";
import { checkTsconfig } from "../src/checks";
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
  const base = {
    module: "commonjs" as any,
    lib: ["es6"],
    noImplicitAny: true,
    noImplicitThis: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    baseUrl: "../",
    typeRoots: ["../"],
    types: [],
    noEmit: true,
    forceConsistentCasingInFileNames: true,
  };
  describe("checks", () => {
    it("disallows unknown compiler options", () => {
      expect(() => checkTsconfig({ ...base, completelyInvented: true }, { relativeBaseUrl: "../" })).toThrow(
        "Unexpected compiler option completelyInvented"
      );
    });
    it("allows exactOptionalPropertyTypes: true", () => {
      expect(checkTsconfig({ ...base, exactOptionalPropertyTypes: true }, { relativeBaseUrl: "../" })).toBeFalsy();
    });
    it("disallows exactOptionalPropertyTypes: false", () => {
      expect(() => checkTsconfig({ ...base, exactOptionalPropertyTypes: false }, { relativeBaseUrl: "../" })).toThrow(
        'When "exactOptionalPropertyTypes" is present, it must be set to `true`.'
      );
    });
    it("disallows packages that are in notNeededPackages.json", () => {
      expect(() => assertPackageIsNotDeprecated("foo", '{ "packages": { "foo": { } } }')).toThrow(
        "notNeededPackages.json has an entry for foo."
      );
    });
    it("allows packages that are not in notNeededPackages.json", () => {
      expect(assertPackageIsNotDeprecated("foo", '{ "packages": { "bar": { } } }')).toBeUndefined();
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
