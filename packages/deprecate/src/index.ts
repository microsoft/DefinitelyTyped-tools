#!/usr/bin/env node

import console from "console";
import process from "process";
import { AllPackages, getDefinitelyTyped } from "@definitelytyped/definitions-parser";
import { NpmPublishClient } from "@definitelytyped/utils";
import { graphql } from "@octokit/graphql";
import search from "libnpmsearch";
// @ts-expect-error
import { packages } from "typescript-dom-lib-generator/deploy/createTypesPackages.js";
import yargs from "yargs";

(async () => {
  const { dryRun } = yargs(process.argv).argv as never;
  const options = { definitelyTypedPath: undefined, progress: false, parseInParallel: false };
  // @ts-expect-error
  const domLibs = new Set(packages.map((pkg) => pkg.name));
  const dt = await getDefinitelyTyped(options, console);
  const allPackages = await AllPackages.read(dt);
  const client = await NpmPublishClient.create(process.env.NPM_TOKEN!);
  // Loop over npm @types packages and mark as deprecated any that no longer exist in the DT repo.
  let from = 0;
  let results;
  do {
    const opts = { limit: 250, from };
    // Won't return already-deprecated packages.
    results = await search("@types", opts);
    for (const result of results) {
      // Skip @types/web, etc.
      if (domLibs.has(result.name)) continue;
      const types = result.name.slice("@types/".length);
      // Skip ones that exist, either in the types/ directory or in notNeededPackages.json.
      if (allPackages.tryGetLatestVersion(types) || allPackages.getNotNeededPackage(types)) continue;
      const msg = await fetchMsg(types);
      if (!msg) {
        console.log(`Could not find the commit that removed types/${types}/.`);
        continue;
      }
      console.log(`Deprecating ${result.name}: ${msg}`);
      if (!dryRun) await client.deprecate(result.name, "*", msg);
    }
    from += results.length;
    // The registry API clamps limit at 250 and from at 5,000, so we can only loop over 5,250 packages, for now.
  } while (results.length >= 250 && from <= 5000);
})();

/** Reference the commit/PR that removed the named types. */
async function fetchMsg(types: string) {
  const {
    repository: {
      defaultBranchRef: {
        target: {
          history: {
            nodes: [commit],
          },
        },
      },
    },
  } = await graphql(
    `
      query ($path: String!) {
        repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 1, path: $path) {
                  nodes {
                    associatedPullRequests(first: 1) {
                      nodes {
                        url
                      }
                    }
                    messageHeadline
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      headers: { authorization: `token ${process.env.GITHUB_TOKEN}` },
      path: `types/${types}/`,
    }
  );
  if (!commit) return;
  const {
    associatedPullRequests: {
      nodes: [pullRequest],
    },
    messageHeadline,
  } = commit;
  const subject = messageHeadline.replace(new RegExp(String.raw`^\[${types}] `), "").replace(/ \(#[0-9]+\)$/, "");
  return pullRequest ? `${subject} ${pullRequest.url}` : subject;
}
