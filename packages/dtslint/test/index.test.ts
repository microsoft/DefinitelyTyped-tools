/// <reference types="jest" />
import { join } from "path";
import { consoleTestResultHandler, runTest } from "tslint/lib/test";
import { existsSync, readdirSync } from "fs";

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
  const tests = readdirSync(testDir).filter(x => x !== "index.test.ts");
  for (const testName of tests) {
    const testDirectory = join(testDir, testName);
    if (existsSync(join(testDirectory, "tslint.json"))) {
      testSingle(testDirectory);
    } else {
      for (const subTestName of readdirSync(testDirectory)) {
        testSingle(join(testDirectory, subTestName));
      }
    }
  }
});
