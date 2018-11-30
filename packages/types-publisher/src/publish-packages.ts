import * as yargs from "yargs";

import appInsights = require("applicationinsights");
import { Fetcher } from "./util/io";
import { getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { NpmPublishClient } from "./lib/npm-client";
import { deprecateNotNeededPackage, publishNotNeededPackage, publishTypingsPackage } from "./lib/package-publisher";
import { AllPackages } from "./lib/packages";
import { ChangedPackages, readChangedPackages } from "./lib/versions";
import { logger, writeLog } from "./util/logging";
import { logUncaughtErrors } from "./util/util";

if (!module.parent) {
    const dry = !!yargs.argv.dry;
    const deprecateName = yargs.argv.deprecate as string | undefined;
    logUncaughtErrors(async () => {
        const dt = await getDefinitelyTyped(Options.defaults);
        if (deprecateName !== undefined) {
            // A '--deprecate' command is available in case types-publisher got stuck *while* trying to deprecate a package.
            // Normally this should not be needed.
            await deprecateNotNeededPackage(await NpmPublishClient.create(), await AllPackages.readSingleNotNeeded(deprecateName, dt));
        } else {
            await publishPackages(await readChangedPackages(await AllPackages.read(dt)), dry, process.env["GH_API_TOKEN"] || "", new Fetcher());
        }
    });
}

export default async function publishPackages(changedPackages: ChangedPackages, dry: boolean, githubAccessToken: string, fetcher: Fetcher): Promise<void> {
    const [log, logResult] = logger();
    if (dry) {
        log("=== DRY RUN ===");
    }

    const client = await NpmPublishClient.create();

    for (const cp of changedPackages.changedTypings) {
        log(`Publishing ${cp.pkg.desc}...`);
        await publishTypingsPackage(client, cp, dry, log);

        const path = `repos/DefinitelyTyped/DefinitelyTyped/commits?path=types%2f${cp.pkg.desc}&access_token=${githubAccessToken}`;
        log("Requesting from github: " + path);
        const commits = await fetcher.fetchJson({
            hostname: "api.github.com",
            path,
            method: "GET",
            headers: {
                // arbitrary string, but something must be provided
                "User-Agent": "types-publisher",
            },
        }) as any[];
        if (commits.length > 0) {
            const latency = Date.now() - new Date(commits[0].commit.author.date).valueOf();
            log("Found related commits, logging event and metric:" + latency);
            log("Current date is " + new Date(Date.now()));
            log(" Commit date is " + new Date(commits[0].commit.author.date));
            log(" Commit hash is " + commits[0].sha);
            appInsights.defaultClient.trackEvent({
                name: "publish package",
                properties: {
                    name: cp.pkg.desc,
                    latency: latency.toString()
                }
            });
            appInsights.defaultClient.trackMetric({ name: "publish latency", value: latency });
            log("Done logging latency");
        }
    }
    for (const n of changedPackages.changedNotNeededPackages) {
        await publishNotNeededPackage(client, n, dry, log);
    }

    await writeLog("publishing.md", logResult());
    console.log("Done!");
}
