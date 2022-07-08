#!/usr/bin/env node

import console from "console";
import process from "process";
import { AllPackages, getDefinitelyTyped } from "@definitelytyped/definitions-parser";
import { NpmPublishClient, cacheDir } from "@definitelytyped/utils";
import { graphql } from "@octokit/graphql";
import names from "all-the-package-names" assert { type: "json" };
import pacote from "pacote";
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
  for (const name of names) {
    // Skip @types/web, etc.
    if (!name.startsWith("@types/") || domLibs.has(name)) continue;
    const types = name.slice("@types/".length);
    // Skip ones that exist, either in the types/ directory or in notNeededPackages.json.
    if (allPackages.tryGetLatestVersion(types) || allPackages.getNotNeededPackage(types)) continue;
    // Skip already-deprecated packages.
    // Cache package deprecation indefinitely.
    const offline = await pacote.manifest(name, { cache: cacheDir, offline: true }).catch((reason) => {
      if (reason.code !== "ENOTCACHED") throw reason;
      return undefined;
    });
    if (offline?.deprecated) continue;
    const online = await pacote.manifest(name, { cache: cacheDir, preferOnline: true });
    if (online.deprecated) continue;
    const msg = await fetchMsg(types);
    if (!msg) {
      console.log(`Could not find the commit that removed types/${types}/.`);
      continue;
    }
    console.log(`Deprecating ${name}: ${msg}`);
    if (!dryRun) await client.deprecate(name, "*", msg);
  }
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
