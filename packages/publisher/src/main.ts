import { Fetcher, loggerWithErrors } from "@definitelytyped/utils";
import * as yargs from "yargs";
import full from "./full";
import { Secret, getSecret } from "./lib/secrets";
import { currentTimeStamp } from "./util/util";

export default async function main() {
  const githubAccessToken = await getSecret(Secret.GITHUB_ACCESS_TOKEN);
  const dry = !!(yargs.argv.dry || process.env.WEBHOOK_FORCE_DRY);

  console.log(`=== ${dry ? "DRY" : "PRODUCTION"} RUN ===`);
  const fetcher = new Fetcher();
  const log = loggerWithErrors()[0];
  log.info("");
  log.info("");
  log.info(`# ${currentTimeStamp()}`);
  log.info("");
  log.info("Starting full...");
  await full(
    dry,
    githubAccessToken,
    fetcher,
    {
      definitelyTypedPath: undefined,
      parseInParallel: false,
      progress: false,
    },
    log
  );
}
