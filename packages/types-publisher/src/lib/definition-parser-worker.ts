import assert = require("assert");
import process = require("process");

import { done } from "../util/util";

import { getTypingInfo, TypingInfo } from "./definition-parser";

if (!module.parent) {
	process.on("message", message => {
		assert(process.argv.length === 3);
		const typesPath = process.argv[2];
		done(go(message as ReadonlyArray<string>, typesPath));
	});
}

export const definitionParserWorkerFilename = __filename;

export interface DefinitionParserWorkerArgs {
	packageName: string;
	typesPath: string;
}

export interface TypingInfoWithPackageName extends TypingInfo {
	packageName: string;
}

async function go(packageNames: ReadonlyArray<string>, typesPath: string): Promise<void> {
	for (const packageName of packageNames) {
		const info = await getTypingInfo(packageName, typesPath);
		const result: TypingInfoWithPackageName = { ...info, packageName };
		process.send!(result);
	}
}
