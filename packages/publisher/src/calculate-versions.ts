import assert = require("assert");

import { defaultLocalOptions } from "./lib/common";
import { CachedNpmInfoClient, NpmInfoVersion, UncachedNpmInfoClient, withNpmCache } from "./lib/npm-client";
import { ChangedPackages, ChangedPackagesJson, ChangedTypingJson, versionsFilename } from "./lib/versions";
import {
  getDefinitelyTyped,
  AllPackages,
  TypingsData,
  NotNeededPackage,
  writeDataFile
} from "@definitelytyped/definitions-parser";
import {
  assertDefined,
  best,
  logUncaughtErrors,
  mapDefined,
  mapDefinedAsync,
  loggerWithErrors,
  FS,
  LoggerWithErrors,
  Semver
} from "@definitelytyped/utils";

if (!module.parent) {
  const log = loggerWithErrors()[0];
  logUncaughtErrors(async () =>
    calculateVersions(await getDefinitelyTyped(defaultLocalOptions, log), new UncachedNpmInfoClient(), log)
  );
}

export default async function calculateVersions(
  dt: FS,
  uncachedClient: UncachedNpmInfoClient,
  log: LoggerWithErrors
): Promise<ChangedPackages> {
  log.info("=== Calculating versions ===");
  return withNpmCache(uncachedClient, async client => {
    log.info("* Reading packages...");
    const packages = await AllPackages.read(dt);
    return computeAndSaveChangedPackages(packages, log, client);
  });
}

async function computeAndSaveChangedPackages(
  allPackages: AllPackages,
  log: LoggerWithErrors,
  client: CachedNpmInfoClient
): Promise<ChangedPackages> {
  const cp = await computeChangedPackages(allPackages, log, client);
  const json: ChangedPackagesJson = {
    changedTypings: cp.changedTypings.map(
      ({ pkg: { id }, version, latestVersion }): ChangedTypingJson => ({ id, version, latestVersion })
    ),
    changedNotNeededPackages: cp.changedNotNeededPackages.map(p => p.name)
  };
  await writeDataFile(versionsFilename, json);
  return cp;
}

async function computeChangedPackages(
  allPackages: AllPackages,
  log: LoggerWithErrors,
  client: CachedNpmInfoClient
): Promise<ChangedPackages> {
  log.info("# Computing changed packages...");
  const changedTypings = await mapDefinedAsync(allPackages.allTypings(), async pkg => {
    const { version, needsPublish } = await fetchTypesPackageVersionInfo(pkg, client, /*publish*/ true, log);
    if (needsPublish) {
      log.info(`Changed: ${pkg.desc}`);
      for (const { name } of pkg.packageJsonDependencies) {
        assertDefined(
          await client.fetchAndCacheNpmInfo(name),
          `'${pkg.name}' depends on '${name}' which does not exist on npm. All dependencies must exist.`
        );
      }
      const latestVersion = pkg.isLatest
        ? undefined
        : (await fetchTypesPackageVersionInfo(allPackages.getLatest(pkg), client, /*publish*/ true)).version;
      return { pkg, version, latestVersion };
    }
    return undefined;
  });
  log.info("# Computing deprecated packages...");
  const changedNotNeededPackages = await mapDefinedAsync(allPackages.allNotNeeded(), async pkg => {
    if (!(await isAlreadyDeprecated(pkg, client, log))) {
      assertDefined(
        await client.fetchAndCacheNpmInfo(pkg.unescapedName),
        `To deprecate '@types/${pkg.name}', '${pkg.unescapedName}' must exist on npm.`
      );
      log.info(`To be deprecated: ${pkg.name}`);
      return pkg;
    }
    return undefined;
  });
  return { changedTypings, changedNotNeededPackages };
}

async function fetchTypesPackageVersionInfo(
  pkg: TypingsData,
  client: CachedNpmInfoClient,
  canPublish: boolean,
  log?: LoggerWithErrors
): Promise<{ version: string; needsPublish: boolean }> {
  let info = client.getNpmInfoFromCache(pkg.fullEscapedNpmName);
  let latestVersion = info && getHighestVersionForMajor(info.versions, pkg);
  let latestVersionInfo = latestVersion && assertDefined(info!.versions.get(latestVersion.versionString));
  if (!latestVersionInfo || latestVersionInfo.typesPublisherContentHash !== pkg.contentHash) {
    if (log) {
      log.info(`Version info not cached for ${pkg.desc}`);
    }
    info = await client.fetchAndCacheNpmInfo(pkg.fullEscapedNpmName);
    latestVersion = info && getHighestVersionForMajor(info.versions, pkg);
    latestVersionInfo = latestVersion && assertDefined(info!.versions.get(latestVersion.versionString));
    if (!latestVersionInfo) {
      return { version: versionString(pkg, /*patch*/ 0), needsPublish: true };
    }
  }

  if (latestVersionInfo.deprecated) {
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
    assert(
      pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras",
      `Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`
    );
  }
  const needsPublish = canPublish && pkg.contentHash !== latestVersionInfo.typesPublisherContentHash;
  const patch = needsPublish
    ? latestVersion!.minor === pkg.minor
      ? latestVersion!.patch + 1
      : 0
    : latestVersion!.patch;
  return { version: versionString(pkg, patch), needsPublish };
}

function versionString(pkg: TypingsData, patch: number): string {
  return new Semver(pkg.major, pkg.minor, patch).versionString;
}

async function isAlreadyDeprecated(
  pkg: NotNeededPackage,
  client: CachedNpmInfoClient,
  log: LoggerWithErrors
): Promise<boolean> {
  const cachedInfo = client.getNpmInfoFromCache(pkg.fullEscapedNpmName);
  let latestVersion = cachedInfo && assertDefined(cachedInfo.distTags.get("latest"));
  let latestVersionInfo = cachedInfo && latestVersion && assertDefined(cachedInfo.versions.get(latestVersion));
  if (!latestVersionInfo || !latestVersionInfo.deprecated) {
    log.info(`Version info not cached for deprecated package ${pkg.desc}`);
    const info = assertDefined(await client.fetchAndCacheNpmInfo(pkg.fullEscapedNpmName));
    latestVersion = assertDefined(info.distTags.get("latest"));
    latestVersionInfo = assertDefined(info.versions.get(latestVersion));
  }
  return !!latestVersionInfo.deprecated;
}

function getHighestVersionForMajor(
  versions: ReadonlyMap<string, NpmInfoVersion>,
  { major, minor }: TypingsData
): Semver | undefined {
  const patch = latestPatchMatchingMajorAndMinor(versions.keys(), major, minor);
  return patch === undefined ? undefined : new Semver(major, minor, patch);
}

/** Finds the version with matching major/minor with the latest patch version. */
function latestPatchMatchingMajorAndMinor(
  versions: Iterable<string>,
  newMajor: number,
  newMinor: number
): number | undefined {
  const versionsWithTypings = mapDefined(versions, v => {
    const semver = Semver.tryParse(v);
    if (!semver) {
      return undefined;
    }
    const { major, minor, patch } = semver;
    return major === newMajor && minor === newMinor ? patch : undefined;
  });
  return best(versionsWithTypings, (a, b) => a > b);
}

export async function getLatestTypingVersion(pkg: TypingsData, client: CachedNpmInfoClient): Promise<string> {
  return (await fetchTypesPackageVersionInfo(pkg, client, /*publish*/ false)).version;
}
