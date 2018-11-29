import * as yargs from "yargs";

import appInsights = require("applicationinsights");
import Github = require("@octokit/rest");
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
    const gh = new Github();
    gh.authenticate({
        type: "token",
        token: process.env["GH_API_TOKEN"] || ""
    });
    logUncaughtErrors(async () => {
        const dt = await getDefinitelyTyped(Options.defaults);
        if (deprecateName !== undefined) {
            // A '--deprecate' command is available in case types-publisher got stuck *while* trying to deprecate a package.
            // Normally this should not be needed.
            await deprecateNotNeededPackage(await NpmPublishClient.create(), await AllPackages.readSingleNotNeeded(deprecateName, dt));
        } else {
            await publishPackages(await readChangedPackages(await AllPackages.read(dt)), dry, gh);
        }
    });
}

export default async function publishPackages(changedPackages: ChangedPackages, dry: boolean, github: Github): Promise<void> {
    const [log, logResult] = logger();
    if (dry) {
        log("=== DRY RUN ===");
    }

    const client = await NpmPublishClient.create();

    for (const cp of changedPackages.changedTypings) {
        console.log(`Publishing ${cp.pkg.desc}...`);
        await publishTypingsPackage(client, cp, dry, log);
        const commits = (await github.repos.listCommits({
            owner: "DefinitelyTyped",
            repo: "DefinitelyTyped",
            path: "types/" + cp.pkg.desc,
            per_page: 1
        })).data;
        if (commits.length > 0) {
            // const latency = Date.now() - new Date(commits[0].commit.author.date).valueOf();
            // appInsights.defaultClient.trackEvent({
            //     name: "publish package",
            //     properties: {
            //         name: cp.pkg.desc,
            //         latency: latency.toString()
            //     }
            // });
            // appInsights.defaultClient.trackMetric({ name: "publish latency", value: latency });
        }
    }
    for (const n of changedPackages.changedNotNeededPackages) {
        await publishNotNeededPackage(client, n, dry, log);
    }

    await writeLog("publishing.md", logResult());
    console.log("Done!");
}
