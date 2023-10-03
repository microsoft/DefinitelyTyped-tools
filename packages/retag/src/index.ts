#!/usr/bin/env node

import assert = require("assert");
import yargs from "yargs";
import process = require("process");
import os = require("os");

import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import {
  Logger,
  NpmPublishClient,
  consoleLogger,
  logUncaughtErrors,
  loggerWithErrors,
  LoggerWithErrors,
  cacheDir,
  nAtATime,
} from "@definitelytyped/utils";
import {
  AnyPackage,
  TypingsData,
  AllPackages,
  parseDefinitions,
  getDefinitelyTyped,
} from "@definitelytyped/definitions-parser";
import * as pacote from "pacote";
import * as semver from "semver";

if (module.filename === process.argv[1]) {
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
  if (name) {
    const pkg = await AllPackages.readSingle(name);
    const version = await getLatestTypingVersion(pkg);
    await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
    await updateLatestTag(pkg.fullNpmName, version, publishClient, consoleLogger.info, dry);
  } else {
    await nAtATime(5, await AllPackages.readLatestTypings(), async (pkg) => {
      // Only update tags for the latest version of the package.
      const version = await getLatestTypingVersion(pkg);
      await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
      await updateLatestTag(pkg.fullNpmName, version, publishClient, consoleLogger.info, dry);
    });
  }
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

export async function getLatestTypingVersion(pkg: TypingsData): Promise<string> {
  return (await fetchTypesPackageVersionInfo(pkg, /*publish*/ false)).version;
}

export async function fetchTypesPackageVersionInfo(
  pkg: TypingsData,
  canPublish: boolean,
  log?: LoggerWithErrors
): Promise<{ version: string; needsPublish: boolean }> {
  const spec = `${pkg.fullNpmName}@~${pkg.major}.${pkg.minor}`;
  let info = await pacote.manifest(spec, { cache: cacheDir, fullMetadata: true, offline: true }).catch((reason) => {
    if (reason.code !== "ENOTCACHED" && reason.code !== "ETARGET") throw reason;
    return undefined;
  });
  if (!info || info.typesPublisherContentHash !== pkg.contentHash) {
    if (log) {
      log.info(`Version info not cached for ${pkg.desc}@${info ? info.version : "(no latest version)"}`);
    }
    info = await pacote.manifest(spec, { cache: cacheDir, fullMetadata: true, preferOnline: true }).catch((reason) => {
      if (reason.code !== "E404" && reason.code !== "ETARGET") throw reason;
      return undefined;
    });
    if (!info) {
      return { version: `${pkg.major}.${pkg.minor}.0`, needsPublish: true };
    }
  }

  if (info.deprecated) {
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
    assert(
      pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras",
      `Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`
    );
  }
  const needsPublish = canPublish && pkg.contentHash !== info.typesPublisherContentHash;
  return { version: needsPublish ? semver.inc(info.version, "patch")! : info.version, needsPublish };
}
