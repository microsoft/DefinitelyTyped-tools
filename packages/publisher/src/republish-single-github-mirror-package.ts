/**
 * Republish a single package to github `@types` mirror by name.
 *
 * Usage:
 * $ node dist/republish-single-github-mirror-package.js aframe
 *
 * This program will fail if the github version of the package is up-to-date.
 * You need to set the environment variable GH_API_TOKEN to a token with publish rights to the `@types` org on github.
 */
import yargs = require("yargs");
import { ChangedPackages } from "./lib/versions";
import { defaultLocalOptions } from "./lib/common";
import {
  logUncaughtErrors,
  loggerWithErrors,
  logger,
  NpmPublishClient,
  UncachedNpmInfoClient,
  withNpmCache,
  Registry
} from "@definitelytyped/utils";
import { getLatestTypingVersion } from "@definitelytyped/retag";
import { getDefinitelyTyped, AllPackages } from "@definitelytyped/definitions-parser";
import generatePackages from "./generate-packages";
import { publishTypingsPackage } from "./lib/package-publisher";

if (!module.parent) {
  const name = yargs.argv.name as string;
  console.log(name);
  logUncaughtErrors(async () => {
    const dt = await getDefinitelyTyped(defaultLocalOptions, loggerWithErrors()[0]);
    const allPackages = await AllPackages.read(dt);
    const changedPackages = await changeFromName(allPackages, name);
    await generatePackages(dt, allPackages, changedPackages, /*tgz*/ false);

    const ghClient = await NpmPublishClient.create(process.env.GH_API_TOKEN as string, {}, Registry.Github);
    await publishTypingsPackage(
      ghClient,
      changedPackages.changedTypings[0],
      /*dry*/ false,
      logger()[0],
      Registry.Github
    );
  });
}

async function changeFromName(allPackages: AllPackages, name: string): Promise<ChangedPackages> {
  const pkg = allPackages.tryGetLatestVersion(name);
  if (pkg) {
    return withNpmCache(new UncachedNpmInfoClient(), async infoClient => {
      const version = await getLatestTypingVersion(pkg, infoClient);
      return {
        changedTypings: [{ pkg, version, latestVersion: undefined }],
        changedNotNeededPackages: []
      };
    });
  } else {
    throw new Error("could not find package: " + name);
  }
}
