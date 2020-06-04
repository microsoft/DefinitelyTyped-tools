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
      const fullOne = updateOneAtATime(async (log, timestamp) => {
        log.info("");
        log.info("");
        log.info(`# ${timestamp}`);
        log.info("");
        log.info("Starting full...");
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
      });
      setInterval(
        (log, timestamp) => {
          const result = fullOne(log, timestamp);
          if (!result) {
            return;
          } // already working, so do nothing.
          result.catch(e => {
            log.info(e.toString());
            console.error(e);
          });
        },
        2_000_000,
        loggerWithErrors()[0],
        currentTimeStamp()
      );
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

// Even if there are many changes to DefinitelyTyped in a row, we only perform one update at a time.
function updateOneAtATime(
  doOnce: (log: LoggerWithErrors, timeStamp: string) => Promise<void>
): (log: LoggerWithErrors, timeStamp: string) => Promise<void> | undefined {
  let working = false;

  return (log, timeStamp) => {
    if (working) {
      log.info("Not starting update, because already performing one.");
      return undefined;
    }
    return work();

    async function work(): Promise<void> {
      log.info("Starting update");
      working = true;
      try {
        await doOnce(log, timeStamp);
      } catch (e) {
        log.info(e.toString());
      } finally {
        working = false;
      }
    }
  };
}
