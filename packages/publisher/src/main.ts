import applicationinsights = require("applicationinsights");
import * as yargs from "yargs";
import { pathExists, writeFile, remove } from "fs-extra";
import { getSecret, Secret } from "./lib/secrets";
import { Fetcher, loggerWithErrors, tryReadJson } from "@definitelytyped/utils";
import { currentTimeStamp } from "./util/util";
import full from "./full";
import { getFunctionTimeoutSeconds, lockFilePath } from "./lib/settings";

export default function main() {
  return withFileLock(lockFilePath, async () => {
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
  });
}

type LockFileResult = { triggered: true } | { triggered: false; timestamp: string };

export async function withFileLock(lockFilePath: string, cb: () => Promise<void>): Promise<LockFileResult> {
  console.log("Checking for lock file...");
  if (await pathExists(lockFilePath)) {
    const lastRunStartTimestamp = (await tryReadJson(lockFilePath, isLockfileFormat))?.timestamp || currentTimeStamp();
    const elapsedSeconds = (Date.now() - Date.parse(lastRunStartTimestamp)) / 1000;
    if (elapsedSeconds < getFunctionTimeoutSeconds()) {
      console.log("Lock file exists; new run not triggered.");
      return { triggered: false, timestamp: lastRunStartTimestamp };
    }
  }

  console.log("Lock file does not exist; writing lock file and running.");
  await writeFile(lockFilePath, JSON.stringify({ timestamp: currentTimeStamp() }));
  cb().then(
    () => remove(lockFilePath),
    async (error) => {
      console.error(error?.stack || error?.message || error);
      applicationinsights.defaultClient.trackException({
        exception: error,
      });

      await remove(lockFilePath);
      process.exit(1);
    }
  );

  return { triggered: true };
}

function isLockfileFormat(parsed: any): parsed is { timestamp: string } {
  return parsed && typeof parsed === "object" && "timestamp" in parsed;
}
