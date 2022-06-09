import { defaultLocalOptions } from "./lib/common";
import { ChangedPackages, ChangedPackagesJson, ChangedTypingJson, versionsFilename } from "./lib/versions";
import { getDefinitelyTyped, AllPackages, NotNeededPackage, writeDataFile } from "@definitelytyped/definitions-parser";
import {
  assertDefined,
  mapDefinedAsync,
  logUncaughtErrors,
  loggerWithErrors,
  FS,
  LoggerWithErrors,
  UncachedNpmInfoClient,
  withNpmCache,
  CachedNpmInfoClient,
} from "@definitelytyped/utils";
import { fetchTypesPackageVersionInfo } from "@definitelytyped/retag";
import { cacheDirPath } from "./lib/settings";

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
  return withNpmCache(
    uncachedClient,
    async (client) => {
      log.info("* Reading packages...");
      const packages = await AllPackages.read(dt);
      return computeAndSaveChangedPackages(packages, log, client);
    },
    cacheDirPath
  );
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
    changedNotNeededPackages: cp.changedNotNeededPackages.map((p) => p.name),
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
  const changedTypings = await mapDefinedAsync(allPackages.allTypings(), async (pkg) => {
    const { version, needsPublish } = await fetchTypesPackageVersionInfo(pkg, client, /*publish*/ true, log);
    if (needsPublish) {
      log.info(`Need to publish: ${pkg.desc}@${version}`);
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
  const changedNotNeededPackages = await mapDefinedAsync(allPackages.allNotNeeded(), async (pkg) => {
    if (!(await isAlreadyDeprecated(pkg, client, log))) {
      assertDefined(
        await client.fetchAndCacheNpmInfo(pkg.libraryName),
        `To deprecate '@types/${pkg.name}', '${pkg.libraryName}' must exist on npm.`
      );
      log.info(`To be deprecated: ${pkg.name}`);
      return pkg;
    }
    return undefined;
  });
  return { changedTypings, changedNotNeededPackages };
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
