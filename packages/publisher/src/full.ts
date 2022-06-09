import applicationinsights = require("applicationinsights");
import * as yargs from "yargs";

import calculateVersions from "./calculate-versions";
import { clean } from "./clean";
import generatePackages from "./generate-packages";
import publishPackages from "./publish-packages";
import publishRegistry from "./publish-registry";
import { getDefinitelyTyped, parseDefinitions, ParseDefinitionsOptions } from "@definitelytyped/definitions-parser";
import { Fetcher, logUncaughtErrors, loggerWithErrors, LoggerWithErrors, assertDefined } from "@definitelytyped/utils";
import { numberOfOsProcesses } from "./util/util";
import { defaultLocalOptions } from "./lib/common";

if (!module.parent) {
  if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
    applicationinsights.setup();
    applicationinsights.start();
  }
  const dry = !!yargs.argv.dry;
  logUncaughtErrors(
    full(dry, process.env.GH_API_TOKEN || "", new Fetcher(), defaultLocalOptions, loggerWithErrors()[0])
  );
}

export default async function full(
  dry: boolean,
  githubAccessToken: string,
  fetcher: Fetcher,
  options: ParseDefinitionsOptions,
  log: LoggerWithErrors
): Promise<void> {
  clean();
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = await parseDefinitions(
    dt,
    options.parseInParallel
      ? { nProcesses: numberOfOsProcesses, definitelyTypedPath: assertDefined(options.definitelyTypedPath) }
      : undefined,
    log
  );
  const changedPackages = await calculateVersions(dt, log);
  await generatePackages(dt, allPackages, changedPackages);
  await publishPackages(changedPackages, dry, githubAccessToken, fetcher);
  await publishRegistry(dt, allPackages, dry);
}
