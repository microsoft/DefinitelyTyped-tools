import * as yargs from "yargs";

import calculateVersions from "./calculate-versions";
import { clean } from "./clean";
import generatePackages from "./generate-packages";
import publishPackages from "./publish-packages";
import { getDefinitelyTyped, ParseDefinitionsOptions } from "@definitelytyped/definitions-parser";
import { Fetcher, logUncaughtErrors, loggerWithErrors, LoggerWithErrors } from "@definitelytyped/utils";
import { defaultLocalOptions } from "./lib/common";

if (require.main === module) {
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
  const changedPackages = await calculateVersions(dt, log);
  await generatePackages(dt, changedPackages);
  await publishPackages(changedPackages, dry, githubAccessToken, fetcher);
}
