import yargs = require("yargs");

import clean from "../clean";
import parseDefinitions from "../parse-definitions";
import checkParseResults from "../check-parse-results";
import { Options } from "../lib/common";
import { done } from "../util/util";

import runTests, { testerOptions } from "./test-runner";

if (!module.parent) {
	const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
	done(main(options));
}

export default async function main(options: Options): Promise<void> {
	await clean();
	await parseDefinitions(options);
	await checkParseResults();
	await runTests(options);
}
