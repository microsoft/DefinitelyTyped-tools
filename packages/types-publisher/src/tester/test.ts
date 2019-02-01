import yargs = require("yargs");

import checkParseResults from "../check-parse-results";
import clean from "../clean";
import { getDefinitelyTyped } from "../get-definitely-typed";
import { TesterOptions } from "../lib/common";
import { UncachedNpmInfoClient } from "../lib/npm-client";
import parseDefinitions from "../parse-definitions";
import { logUncaughtErrors } from "../util/util";
import { loggerWithErrors } from "../util/logging";

import runTests, { parseNProcesses, testerOptions } from "./test-runner";

if (!module.parent) {
    const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
    const all = !!yargs.argv.all;
    logUncaughtErrors(main(options, parseNProcesses(), all));
}

async function main(options: TesterOptions, nProcesses: number, all: boolean): Promise<void> {
    await clean();
    const log = loggerWithErrors()[0];
    const dt = await getDefinitelyTyped(options, log);
    await parseDefinitions(dt, { nProcesses, definitelyTypedPath: options.definitelyTypedPath }, log);
    await checkParseResults(/*includeNpmChecks*/false, dt, options, new UncachedNpmInfoClient());
    await runTests(dt, options.definitelyTypedPath, nProcesses, all ? "all" : "affected");
}
