import * as yargs from "yargs";

import { defaultLocalOptions } from "./lib/common";
import { publishNotNeededPackage, publishTypingsPackage } from "./lib/package-publisher";
import { getDefinitelyTyped, AllPackages } from "@definitelytyped/definitions-parser";
import {
  loggerWithErrors,
  logUncaughtErrors,
  logger,
  Fetcher,
  writeLog,
  NpmPublishClient,
} from "@definitelytyped/utils";
import { readChangedPackages, ChangedPackages } from "./lib/versions";
import { skipBadPublishes } from "./lib/npm";
import { getSecret, Secret } from "./lib/secrets";

if (require.main === module) {
  const dry = !!yargs.argv.dry;
  logUncaughtErrors(async () => {
    const dt = await getDefinitelyTyped(defaultLocalOptions, loggerWithErrors()[0]);
    await publishPackages(
      await readChangedPackages(await AllPackages.read(dt)),
      dry,
      process.env.GH_API_TOKEN || "",
      new Fetcher()
    );
  });
}

export default async function publishPackages(
  changedPackages: ChangedPackages,
  dry: boolean,
  githubAccessToken: string,
  fetcher: Fetcher
): Promise<void> {
  const [log, logResult] = logger();
  if (dry) {
    log("=== DRY RUN ===");
  } else {
    log("=== Publishing packages ===");
  }

  const client = await NpmPublishClient.create(await getSecret(Secret.NPM_TYPES_TOKEN), undefined);

  for (const cp of changedPackages.changedTypings) {
    log(`Publishing ${cp.pkg.desc}...`);

    await publishTypingsPackage(client, cp, dry, log);

    const commits = (await queryGithub(
      `repos/DefinitelyTyped/DefinitelyTyped/commits?path=types%2f${cp.pkg.subDirectoryPath}`,
      githubAccessToken,
      fetcher
    )) as {
      sha: string;
      commit: {
        message: string;
        author: {
          date: string;
        };
      };
    }[];

    const firstCommit = commits[0];
    if (firstCommit && !firstCommit.commit.message.includes("#no-publishing-comment")) {
      log("Found related commits; hash: " + commits[0].sha);
      const prs = (await queryGithub(
        `search/issues?q=is:pr%20is:merged%20${commits[0].sha}`,
        githubAccessToken,
        fetcher
      )) as { items: { number: number }[] };
      let latestPr = 0;
      for (const pr of prs.items) {
        if (pr.number > latestPr) {
          latestPr = pr.number;
        }
      }
      log("Latest PR: " + latestPr);
      if (latestPr === 0) {
        continue;
      }
      const latest = (await queryGithub(
        `repos/DefinitelyTyped/DefinitelyTyped/pulls/${latestPr}`,
        githubAccessToken,
        fetcher
      )) as { merged_at: string };
      log("Current date is " + new Date(Date.now()).toString());
      log("  Merge date is " + new Date(latest.merged_at).toString());

      const published = cp.pkg.fullNpmName + "@" + cp.version;
      const publishNotification =
        "I just published [`" + published + "` to npm](https://www.npmjs.com/package/" + cp.pkg.fullNpmName + ").";
      log(publishNotification);
      if (dry) {
        log("(dry) Skip publishing notification to github.");
      } else {
        const commented = await postGithub(
          `repos/DefinitelyTyped/DefinitelyTyped/issues/${latestPr}/comments`,
          { body: publishNotification },
          githubAccessToken,
          fetcher
        );
        log("From github: " + JSON.stringify(commented).slice(0, 200));
      }
    }
  }

  for (const n of changedPackages.changedNotNeededPackages) {
    const target = await skipBadPublishes(n, log);
    await publishNotNeededPackage(client, target, dry, log);
  }

  await writeLog("publishing.md", logResult());
  console.log("Done!");
}

async function postGithub(path: string, data: any, githubToken: string, fetcher: Fetcher) {
  const [log] = logger();
  const body = JSON.stringify(data);
  log(`Posting to github at ${path}: ${body}`);
  return fetcher.fetchJson({
    hostname: "api.github.com",
    method: "POST",
    path,
    body,
    headers: {
      // arbitrary string, but something must be provided
      "User-Agent": "types-publisher",
      "Content-Type": "application/json",
      Authorization: "token " + githubToken,
      "Content-Length": Buffer.byteLength(body),
    },
  });
}

async function queryGithub(path: string, githubToken: string, fetcher: Fetcher) {
  const [log] = logger();
  log("Requesting from github: " + path);
  return fetcher.fetchJson({
    hostname: "api.github.com",
    method: "GET",
    path: path + "&access_token=" + githubToken,
    headers: {
      // arbitrary string, but something must be provided
      "User-Agent": "types-publisher",
    },
  });
}
