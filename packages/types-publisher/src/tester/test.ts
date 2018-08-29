import yargs = require("yargs");

import checkParseResults from "../check-parse-results";
import clean from "../clean";
import { Options } from "../lib/common";
import { UncachedNpmInfoClient } from "../lib/npm-client";
import parseDefinitions from "../parse-definitions";
import { done } from "../util/util";

import runTests, { parseNProcesses, testerOptions } from "./test-runner";

if (!module.parent) {
	const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
	const all = !!yargs.argv.all;
	done(main(options, parseNProcesses(), all));
}

async function main(options: Options, nProcesses: number, all: boolean): Promise<void> {
	await clean();
	await parseDefinitions(options, nProcesses);
	await checkParseResults(/*includeNpmChecks*/false, options, new UncachedNpmInfoClient());
	await runTests(options, nProcesses, all ? "all" : "affected");
}
