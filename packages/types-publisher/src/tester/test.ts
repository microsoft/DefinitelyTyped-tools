import yargs = require("yargs");

import checkParseResults from "../check-parse-results";
import clean from "../clean";
import { Options } from "../lib/common";
import parseDefinitions from "../parse-definitions";
import { done } from "../util/util";

import runTests, { parseNProcesses, testerOptions } from "./test-runner";

if (!module.parent) {
	const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
	const tsNext = !!yargs.argv.tsNext;
	const all = !!yargs.argv.all;
	done(main(options, parseNProcesses(), all, tsNext));
}

async function main(options: Options, nProcesses: number, all: boolean, tsNext: boolean): Promise<void> {
	await clean();
	await parseDefinitions(options);
	await checkParseResults(/*includeNpmChecks*/false, options);
	await runTests(options, nProcesses, all ? "all" : "affected", tsNext);
}
