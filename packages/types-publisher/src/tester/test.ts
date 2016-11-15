import yargs = require("yargs");

import clean from "../clean";
import parseDefinitions from "../parse-definitions";
import checkParseResults from "../check-parse-results";
import { Options } from "../lib/common";
import { done } from "../util/util";

import runTests, { parseNProcesses, testerOptions } from "./test-runner";

if (!module.parent) {
	const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
	done(main(options, parseNProcesses()));
}

async function main(options: Options, nProcesses?: number): Promise<void> {
	await clean();
	await parseDefinitions(options);
	await checkParseResults();
	await runTests(options, nProcesses);
}
