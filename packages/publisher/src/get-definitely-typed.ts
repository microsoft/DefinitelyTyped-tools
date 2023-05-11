import assert from "assert";
import yargs from "yargs";
import applicationinsights from "applicationinsights";
import { logUncaughtErrors, loggerWithErrors } from "@definitelytyped/utils";
import { getDefinitelyTyped } from "@definitelytyped/definitions-parser";
import { defaultLocalOptions, defaultRemoteOptions } from "./lib/common";

if (!module.parent) {
  if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
    applicationinsights.setup();
    applicationinsights.start();
  }
  const dry = !!yargs.argv.dry;
  console.log("gettingDefinitelyTyped: " + (dry ? "from github" : "locally"));
  logUncaughtErrors(async () => {
    const dt = await getDefinitelyTyped(dry ? defaultRemoteOptions : defaultLocalOptions, loggerWithErrors()[0]);
    assert(dt.exists("types"));
    assert(!dt.exists("buncho"));
  });
}
