import applicationinsights = require("applicationinsights");
import * as yargs from "yargs";
import { getSecret, Secret } from "./lib/secrets";
import webhookServer from "./lib/webhook-server";
import { Fetcher, logUncaughtErrors } from "@definitelytyped/utils";

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
    if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
      applicationinsights.setup().start();
      console.log("Done initialising App Insights");
    }
    const fetcher = new Fetcher();
    try {
      const s = await webhookServer(key, githubAccessToken, dry, fetcher, {
        definitelyTypedPath: undefined,
        progress: false,
        parseInParallel: true
      });
      console.log(`Listening on port ${port}`);
      s.listen(port);
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
