import assert = require("assert");
import process = require("process");
import { logUncaughtErrors } from "@definitelytyped/utils";
import { getLocallyInstalledDefinitelyTyped } from "../get-definitely-typed";
import { getTypingInfo } from "./definition-parser";
import { dirname } from "path";

// This file is "called" by runWithChildProcesses from parse-definition.ts
export const definitionParserWorkerFilename = __filename;

if (!module.parent) {
  process.on("message", (message) => {
    assert(process.argv.length === 3);
    const typesPath = process.argv[2];
    // tslint:disable-next-line no-async-without-await
    logUncaughtErrors(async () => {
      for (const packageName of message as readonly string[]) {
        const data = await getTypingInfo(
          packageName,
          getLocallyInstalledDefinitelyTyped(dirname(typesPath))
        );
        process.send!({ data, packageName });
      }
    });
  });
}
