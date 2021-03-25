import applicationinsights = require("applicationinsights");
import * as yargs from "yargs";
import { pathExists, writeFile, readFile, remove } from "fs-extra";
import { getSecret, Secret } from "./lib/secrets";
import { Fetcher, loggerWithErrors } from "@definitelytyped/utils";
import { currentTimeStamp } from "./util/util";
import full from "./full";
import { lockFilePath } from "./lib/settings";

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
          progress: false
        },
        log
      );
    }
  });
}

type LockFileResult = { triggered: true } | { triggered: false, timestamp: string };

async function withFileLock(lockFilePath: string, cb: () => Promise<void>): Promise<LockFileResult> {
  if (await pathExists(lockFilePath)) {
    return { triggered: false, timestamp: await readFile(lockFilePath, "utf8")};
  } else {
    await writeFile(lockFilePath, currentTimeStamp());
    cb().then(() => remove(lockFilePath), async error => {
      await removeLock();
      applicationinsights.defaultClient.trackEvent({
        name: "crash",
        properties: {
          error: String(error)
        }
      });

      process.exit(1);
    });

    return { triggered: true };
  }

  async function removeLock() {
    await remove(lockFilePath);
  }
}
