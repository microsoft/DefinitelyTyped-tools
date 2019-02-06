import assert = require("assert");
import process = require("process");

import { getLocallyInstalledDefinitelyTyped } from "../get-definitely-typed";
import { logUncaughtErrors } from "../util/util";

import { getTypingInfo } from "./definition-parser";

// This file is "called" by runWithChildProcesses from parse-definition.ts
export const definitionParserWorkerFilename = __filename;

if (!module.parent) {
    process.on("message", message => {
        assert(process.argv.length === 3);
        const typesPath = process.argv[2];
        logUncaughtErrors(async () => {
            for (const packageName of message as ReadonlyArray<string>) {
                const data = await getTypingInfo(packageName, getLocallyInstalledDefinitelyTyped(typesPath).subDir(packageName));
                process.send!({ data, packageName });
            }
        });
    });
}


