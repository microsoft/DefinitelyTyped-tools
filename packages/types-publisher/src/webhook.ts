import * as yargs from "yargs";
import { setInterval } from "timers";
import appInsights = require("applicationinsights");

import full from "./full";
import { Options } from "./lib/common";
import { getSecret, Secret } from "./lib/secrets";
import { LoggerWithErrors, loggerWithErrors } from "./util/logging";
import { Fetcher } from "./util/io";
import { logUncaughtErrors, currentTimeStamp } from "./util/util";

if (!module.parent) {
    logUncaughtErrors(main());
}

export default async function main(): Promise<void> {
    const key = await getSecret(Secret.GITHUB_SECRET);
    const githubAccessToken = await getSecret(Secret.GITHUB_ACCESS_TOKEN);
    const dry = !!(yargs.argv.dry || process.env.WEBHOOK_FORCE_DRY);

    if (!(key && githubAccessToken)) {
        console.log("The environment variables GITHUB_SECRET and GITHUB_ACCESS_TOKEN must be set.");
    } else {
        console.log(`=== ${dry ? "DRY" : "PRODUCTION"} RUN ===`);
        appInsights.setup(process.env["APPINSIGHTS_INSTRUMENTATIONKEY"]).start();
        console.log("Done initialising App Insights");
        const fetcher = new Fetcher();
        try {
             await webhookServer(githubAccessToken, dry, fetcher, Options.azure);
        }
        catch (e) {
            appInsights.defaultClient.trackEvent({
                name: "crash",
                properties: {
                    error: e.toString()
                },
            })
            throw e;
        }
    }
}

async function webhookServer(
    githubAccessToken: string,
    dry: boolean,
    fetcher: Fetcher,
    options: Options,
): Promise<void> {
    const fullOnce = updateOneAtATime(async (log) => {
        const timeStamp = currentTimeStamp();
        log.info(""); log.info("");
        log.info(`# ${timeStamp}`);
        log.info("");
        log.info("Starting full...");
        await full(dry, timeStamp, githubAccessToken, fetcher, options);
    });

    const log = loggerWithErrors()[0];
    await fullOnce(log);
    setInterval(fullOnce, 1_000_000, log);
}

// Even if there are many changes to DefinitelyTyped in a row, we only perform one update at a time.
function updateOneAtATime(
    doOnce: (log: LoggerWithErrors) => Promise<void>,
): (log: LoggerWithErrors) => Promise<void> | undefined {
    let working = false;
    let anyUpdatesWhileWorking = false;

    return (log) => {
        if (working) {
            anyUpdatesWhileWorking = true;
            log.info("Not starting update, because already performing one.");
            return undefined;
        } else {
            working = false;
            anyUpdatesWhileWorking = false;
            return work();
        }

        async function work(): Promise<void> {
            log.info("Starting update");
            working = true;
            anyUpdatesWhileWorking = false;
            do {
                await doOnce(log);
                working = false;
            } while (anyUpdatesWhileWorking);
        }
    };
}
