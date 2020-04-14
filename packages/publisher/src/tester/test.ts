import yargs = require("yargs");

import checkParseResults from "../check-parse-results";
import { clean } from "../clean";
import { getDefinitelyTyped, parseDefinitions, getAffectedPackagesFromDiff } from "@definitelytyped/definitions-parser";
import { logUncaughtErrors, loggerWithErrors, UncachedNpmInfoClient } from "@definitelytyped/utils";
import { TesterOptions } from "../lib/common";
import runTests, { parseNProcesses, testerOptions } from "./test-runner";

if (!module.parent) {
  const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
  const all = !!yargs.argv.all;
  logUncaughtErrors(main(options, parseNProcesses(), all));
}

async function main(options: TesterOptions, nProcesses: number, all: boolean): Promise<void> {
  clean();
  const log = loggerWithErrors()[0];
  const dt = await getDefinitelyTyped(options, log);
  await parseDefinitions(dt, { nProcesses, definitelyTypedPath: options.definitelyTypedPath }, log);
  try {
    await checkParseResults(/*includeNpmChecks*/ false, dt, options, new UncachedNpmInfoClient());
  } catch (e) {
    if (!all) {
      await getAffectedPackagesFromDiff(dt, options.definitelyTypedPath, "affected");
    }

    throw e;
  }
  await runTests(dt, options.definitelyTypedPath, nProcesses, all ? "all" : "affected");
}
