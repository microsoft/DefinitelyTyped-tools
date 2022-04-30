#!/usr/bin/env node

import assert = require("assert");
import yargs from "yargs";
import process = require("process");
import os = require("os");

import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import {
  Logger,
  assertDefined,
  withNpmCache,
  NpmPublishClient,
  UncachedNpmInfoClient,
  consoleLogger,
  NpmInfoVersion,
  logUncaughtErrors,
  loggerWithErrors,
  LoggerWithErrors,
  nAtATime,
  CachedNpmInfoClient,
} from "@definitelytyped/utils";
import {
  AnyPackage,
  TypingsData,
  AllPackages,
  parseDefinitions,
  getDefinitelyTyped,
} from "@definitelytyped/definitions-parser";
import * as semver from "semver";

if (!module.parent) {
  logUncaughtErrors(main);
}

async function main() {
  const { dry, nProcesses, name } = yargs.options({
    dry: { type: "boolean", default: false },
    nProcesses: { type: "number", default: os.cpus().length },
    name: { type: "string" },
  }).argv;
  await tag(dry, nProcesses, name);
}

/**
 * Refreshes the tags on every package.
 * This needs to be run whenever a new version of Typescript is released.
 *
 * It can also refresh the tags on a single package, which can un-wedge types-publisher in certain cases.
 * This shouldn't normally need to run, since we run `tagSingle` whenever we publish a package.
 * But this should be run if the way we calculate tags changes (e.g. when a new release is allowed to be tagged "latest").
 */
async function tag(dry: boolean, nProcesses: number, name?: string) {
  const log = loggerWithErrors()[0];
  const options = { definitelyTypedPath: "../DefinitelyTyped", progress: true, parseInParallel: true };
  await parseDefinitions(
    await getDefinitelyTyped(options, log),
    { nProcesses: nProcesses || os.cpus().length, definitelyTypedPath: "../DefinitelyTyped" },
    log
  );

  const token = process.env.NPM_TOKEN as string;

  const publishClient = await NpmPublishClient.create(token, {});
  await withNpmCache(new UncachedNpmInfoClient(), async (infoClient) => {
    if (name) {
      const pkg = await AllPackages.readSingle(name);
      const version = await getLatestTypingVersion(pkg, infoClient);
      await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
      await updateLatestTag(pkg.fullNpmName, version, publishClient, consoleLogger.info, dry);
    } else {
      await nAtATime(10, await AllPackages.readLatestTypings(), async (pkg) => {
        // Only update tags for the latest version of the package.
        const version = await getLatestTypingVersion(pkg, infoClient);
        await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
        await updateLatestTag(pkg.fullNpmName, version, publishClient, consoleLogger.info, dry);
      });
    }
  });
  // Don't tag notNeeded packages
}

export async function updateTypeScriptVersionTags(
  pkg: AnyPackage,
  version: string,
  client: NpmPublishClient,
  log: Logger,
  dry: boolean
): Promise<void> {
  const tags = TypeScriptVersion.tagsToUpdate(pkg.minTypeScriptVersion);
  const name = pkg.fullNpmName;
  log(`Tag ${name}@${version} as ${JSON.stringify(tags)}`);
  if (dry) {
    log("(dry) Skip tag");
  } else {
    for (const tagName of tags) {
      await client.tag(name, version, tagName, dry, log);
    }
  }
}

export async function updateLatestTag(
  fullName: string,
  version: string,
  client: NpmPublishClient,
  log: Logger,
  dry: boolean
): Promise<void> {
  log(`   but tag ${fullName}@${version} as "latest"`);
  if (dry) {
    log('   (dry) Skip move "latest" back to newest version');
  } else {
    await client.tag(fullName, version, "latest", dry, log);
  }
}

export async function getLatestTypingVersion(pkg: TypingsData, client: CachedNpmInfoClient): Promise<string> {
  return (await fetchTypesPackageVersionInfo(pkg, client, /*publish*/ false)).version;
}

export async function fetchTypesPackageVersionInfo(
  pkg: TypingsData,
  client: CachedNpmInfoClient,
  canPublish: boolean,
  log?: LoggerWithErrors
): Promise<{ version: string; needsPublish: boolean }> {
  let info = client.getNpmInfoFromCache(pkg.fullNpmName);
  let latestVersion = info && getHighestVersionForMajor(info.versions, pkg);
  let latestVersionInfo = latestVersion && assertDefined(info!.versions.get(latestVersion));
  if (!latestVersionInfo || latestVersionInfo.typesPublisherContentHash !== pkg.contentHash) {
    if (log) {
      log.info(`Version info not cached for ${pkg.desc}@${latestVersion || "(no latest version)"}`);
    }
    info = await client.fetchAndCacheNpmInfo(pkg.fullNpmName);
    latestVersion = info && getHighestVersionForMajor(info.versions, pkg);
    if (!latestVersion) {
      return { version: `${pkg.major}.${pkg.minor}.0`, needsPublish: true };
    }
    latestVersionInfo = assertDefined(info!.versions.get(latestVersion));
  }

  if (latestVersionInfo.deprecated) {
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
    assert(
      pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras",
      `Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`
    );
  }
  const needsPublish = canPublish && pkg.contentHash !== latestVersionInfo.typesPublisherContentHash;
  return { version: needsPublish ? semver.inc(latestVersion!, "patch")! : latestVersion!, needsPublish };
}

function getHighestVersionForMajor(
  versions: ReadonlyMap<string, NpmInfoVersion>,
  { major, minor }: TypingsData
): string | null {
  return semver.maxSatisfying([...versions.keys()], `~${major}.${minor}`);
}
