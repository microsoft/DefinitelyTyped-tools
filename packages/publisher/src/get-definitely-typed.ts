import assert from "assert";
import yargs from "yargs";
import { logUncaughtErrors, loggerWithErrors } from "@definitelytyped/utils";
import { getDefinitelyTyped } from "@definitelytyped/definitions-parser";
import { defaultLocalOptions, defaultRemoteOptions } from "./lib/common";

if (!module.parent) {
  const dry = !!yargs.argv.dry;
  console.log("gettingDefinitelyTyped: " + (dry ? "from github" : "locally"));
  logUncaughtErrors(async () => {
    const dt = await getDefinitelyTyped(dry ? defaultRemoteOptions : defaultLocalOptions, loggerWithErrors()[0]);
    assert(dt.exists("types"));
    assert(!dt.exists("buncho"));
  });
}
