#!/usr/bin/env node

import { graphql } from "@octokit/graphql";
import search = require("libnpmsearch");
import * as yargs from "yargs";

import { AllPackages, getDefinitelyTyped } from "@definitelytyped/definitions-parser";
import { getSecret, Secret } from "@definitelytyped/publisher/dist/lib/secrets";
import { loggerWithErrors, NpmPublishClient } from "@definitelytyped/utils";

async function main() {
  const [log] = loggerWithErrors();

  const options = {
    definitelyTypedPath: `${__dirname}/../../../../DefinitelyTyped`,
    progress: true,
    parseInParallel: true
  };
  const dt = await getDefinitelyTyped(options, log);
  const allPackages = await AllPackages.read(dt);

  const { dry } = yargs.argv;
  const client = dry || (await NpmPublishClient.create(await getSecret(Secret.NPM_TOKEN)));

  // Loop over the @types packages in npm and mark any that no longer
  // exist in HEAD as deprecated.
  let from = 0;
  let results;
  do {
    const opts = {
      limit: 250,
      from
    };
    results = await search("@types", opts);
    for (const { name: fullNpmName } of results) {
      const name = fullNpmName.slice("@types/".length);
      // If they don't exist in the types directory or in
      // notNeededPackages.json then mark them deprecated. Reference the
      // commit/pull request that removed them.
      if (!allPackages.tryGetLatestVersion(name) && !allPackages.getNotNeededPackage(name)) {
        log.info(`Deprecating ${name}`);
        const {
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [commit]
                }
              }
            }
          }
        } = await graphql(
          `
            query($path: String!) {
              repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
                ref(qualifiedName: "master") {
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
            headers: { authorization: `token ${process.env.GH_API_TOKEN}` },
            path: `types/${name}`
          }
        );
        let deprecatedMessage;
        if (commit) {
          const {
            associatedPullRequests: {
              nodes: [pullRequest]
            },
            messageHeadline
          } = commit;
          deprecatedMessage = messageHeadline;
          if (pullRequest) {
            deprecatedMessage += ` (${pullRequest.url})`;
          }
        }
        if (dry) {
          log.info(`(dry) Skip deprecate removed package ${fullNpmName}`);
        } else {
          log.info(`Deprecating ${fullNpmName} with message: ${deprecatedMessage}`);
          await (client as NpmPublishClient).deprecate(fullNpmName, "", deprecatedMessage);
        }
      }
    }
    from += results.length;
  } while (results.length >= 250 && from <= 5000);
}
main();
