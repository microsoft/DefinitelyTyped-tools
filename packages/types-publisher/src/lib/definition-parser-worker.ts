import assert = require("assert");
import process = require("process");

import { getLocallyInstalledDefinitelyTyped } from "../get-definitely-typed";
import { logUncaughtErrors } from "../util/util";

import { getTypingInfo } from "./definition-parser";
import { TypingsVersionsRaw } from "./packages";

if (!module.parent) {
    process.on("message", message => {
        assert(process.argv.length === 3);
        const typesPath = process.argv[2];
        logUncaughtErrors(go(message as ReadonlyArray<string>, typesPath));
    });
}

export const definitionParserWorkerFilename = __filename;

export interface DefinitionParserWorkerArgs {
    readonly packageName: string;
    readonly typesPath: string;
}

export interface TypingInfoWithPackageName {
    readonly data: TypingsVersionsRaw;
    readonly packageName: string;
}

async function go(packageNames: ReadonlyArray<string>, typesPath: string): Promise<void> {
    for (const packageName of packageNames) {
        const data = await getTypingInfo(packageName, getLocallyInstalledDefinitelyTyped(typesPath).subDir(packageName));
        const result: TypingInfoWithPackageName = { data, packageName };
        process.send!(result);
    }
}
