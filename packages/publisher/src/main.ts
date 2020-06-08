import applicationinsights = require("applicationinsights");
import * as yargs from "yargs";
import { getSecret, Secret } from "./lib/secrets";
import { Fetcher, loggerWithErrors, LoggerWithErrors } from "@definitelytyped/utils";
import { currentTimeStamp } from "./util/util";
import full from "./full";

export default async function main(): Promise<void> {
  const githubAccessToken = await getSecret(Secret.GITHUB_ACCESS_TOKEN);
  const dry = !!(yargs.argv.dry || process.env.WEBHOOK_FORCE_DRY);

  if (!githubAccessToken) {
    console.log("The environment variable GITHUB_ACCESS_TOKEN must be set.");
  } else {
    console.log(`=== ${dry ? "DRY" : "PRODUCTION"} RUN ===`);
    if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
      applicationinsights.setup().start();
      console.log("Done initialising App Insights");
    }
    const fetcher = new Fetcher();

    try {
      const log = loggerWithErrors()[0];
      const fullOne = updateOneAtATime(async () => {
        log.info("");
        log.info("");
        log.info(`# ${currentTimeStamp()}`);
        log.info("");
        log.info("Starting full...");
        try {
          await full(
            dry,
            githubAccessToken,
            fetcher,
            {
              definitelyTypedPath: undefined,
              parseInParallel: true,
              progress: false
            },
            log
          );
        } catch (err) {
          log.info(err.toString());
          console.error(err);
        }
      });

      setInterval(fullOne, 2_000_000, log);
      await fullOne(log);
    } catch (e) {
      applicationinsights.defaultClient.trackEvent({
        name: "crash",
        properties: {
          error: e.toString()
        }
      });
      throw e;
    }
  }
}

// If an update is still running after 2000 seconds, don’t start a new one
function updateOneAtATime(doOnce: () => Promise<void>) {
  let working = false;

  return (log: LoggerWithErrors) => {
    if (working) {
      log.info("Not starting update, because already performing one.");
      return undefined;
    }
    return work();

    async function work(): Promise<void> {
      log.info("Starting update");
      working = true;
      try {
        await doOnce();
      } catch (e) {
        log.info(e.toString());
      } finally {
        working = false;
      }
    }
  };
}
