import * as yargs from "yargs";

// import appInsights = require("applicationinsights");
import { Options } from "./lib/common";
import { setIssueOk } from "./lib/issue-updater";
import { getSecret, Secret } from "./lib/secrets";
import webhookServer from "./lib/webhook-server";
import { Fetcher } from "./util/io";
import { logUncaughtErrors } from "./util/util";

if (!module.parent) {
    logUncaughtErrors(main());
}

export default async function main(): Promise<void> {
    const key = await getSecret(Secret.GITHUB_SECRET);
    const githubAccessToken = await getSecret(Secret.GITHUB_ACCESS_TOKEN);
    const dry = !!(yargs.argv.dry || process.env.WEBHOOK_FORCE_DRY);
    const port = process.env.PORT;

    if (!(key && githubAccessToken && port)) {
        console.log("The environment variables GITHUB_SECRET and GITHUB_ACCESS_TOKEN and PORT must be set.");
    } else {
        console.log(`=== ${dry ? "DRY" : "PRODUCTION"} RUN ===`);
        // appInsights.setup(process.env["APPINSIGHTS_INSTRUMENTATIONKEY"]).start();
        console.log("Done initialising App Insights");
        const fetcher = new Fetcher();

        const s = await webhookServer(key, githubAccessToken, dry, fetcher, Options.azure);
        await setIssueOk(githubAccessToken, fetcher);
        console.log(`Listening on port ${port}`);
        s.listen(port);
    }
}
