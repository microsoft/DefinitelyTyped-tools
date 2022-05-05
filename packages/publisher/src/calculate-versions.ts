import process from "process";
import { defaultLocalOptions, defaultRemoteOptions } from "./lib/common";
import { ChangedPackages, ChangedPackagesJson, ChangedTypingJson, versionsFilename } from "./lib/versions";
import { getDefinitelyTyped, AllPackages, NotNeededPackage, writeDataFile } from "@definitelytyped/definitions-parser";
import {
  mapDefinedAsync,
  logUncaughtErrors,
  loggerWithErrors,
  FS,
  LoggerWithErrors,
  cacheDir,
} from "@definitelytyped/utils";
import { fetchTypesPackageVersionInfo } from "@definitelytyped/retag";
import * as pacote from "pacote";
import * as semver from "semver";

if (!module.parent) {
  const log = loggerWithErrors()[0];
  logUncaughtErrors(async () =>
    calculateVersions(
      await getDefinitelyTyped(process.env.GITHUB_ACTIONS ? defaultRemoteOptions : defaultLocalOptions, log),
      log
    )
  );
}

export default async function calculateVersions(dt: FS, log: LoggerWithErrors): Promise<ChangedPackages> {
  log.info("=== Calculating versions ===");
  log.info("* Reading packages...");
  const packages = await AllPackages.read(dt);
  return computeAndSaveChangedPackages(packages, log);
}

async function computeAndSaveChangedPackages(
  allPackages: AllPackages,
  log: LoggerWithErrors
): Promise<ChangedPackages> {
  const cp = await computeChangedPackages(allPackages, log);
  const json: ChangedPackagesJson = {
    changedTypings: cp.changedTypings.map(
      ({ pkg: { name }, version, latestVersion }): ChangedTypingJson => ({ name, version, latestVersion })
    ),
    changedNotNeededPackages: cp.changedNotNeededPackages.map(({ pkg: { name }, version }) => ({ name, version })),
  };
  await writeDataFile(versionsFilename, json);
  return cp;
}

async function computeChangedPackages(allPackages: AllPackages, log: LoggerWithErrors): Promise<ChangedPackages> {
  log.info("# Computing changed packages...");
  const changedTypings = await mapDefinedAsync(allPackages.allTypings(), async (pkg) => {
    const { version, needsPublish } = await fetchTypesPackageVersionInfo(pkg, /*publish*/ true, log);
    if (needsPublish) {
      log.info(`Need to publish: ${pkg.desc}@${version}`);
      for (const { name } of pkg.packageJsonDependencies) {
        // Assert that dependencies exist on npm.
        // Also checked when we install the dependencies, in dtslint-runner.
        await pacote.manifest(name, { cache: cacheDir }).catch((reason) => {
          throw reason.code === "E404"
            ? new Error(
                `'${pkg.name}' depends on '${name}' which does not exist on npm. All dependencies must exist.`,
                { cause: reason }
              )
            : reason;
        });
      }
      const latestVersion = pkg.isLatest
        ? undefined
        : (await fetchTypesPackageVersionInfo(allPackages.getLatest(pkg), /*publish*/ true)).version;
      return { pkg, version, latestVersion };
    }
    return undefined;
  });
  log.info("# Computing deprecated packages...");
  const changedNotNeededPackages = await mapDefinedAsync(allPackages.allNotNeeded(), async (pkg) => {
    const incipientVersion = await fetchIncipientStubVersion(pkg, log);
    if (incipientVersion) {
      // Assert that dependencies (i.e. the replacement package) exist on npm.
      // Also checked in checkNotNeededPackage().
      await pacote.manifest(pkg.libraryName, { cache: cacheDir }).catch((reason) => {
        throw reason.code === "E404"
          ? new Error(`To deprecate '@types/${pkg.name}', '${pkg.libraryName}' must exist on npm.`, { cause: reason })
          : reason;
      });
      log.info(`To be deprecated: ${pkg.name}`);
      return { pkg, version: incipientVersion };
    }
    return undefined;
  });
  return { changedTypings, changedNotNeededPackages };
}

/**
 * Return the version of the stub @types package we're about to publish and deprecate, if we haven't already deprecated that package.
 * It's the max of the not-needed version and the max published version + 1, in case we already published a not-needed-versioned stub but failed to deprecate it, for whatever reason.
 */
export async function fetchIncipientStubVersion(pkg: NotNeededPackage, log: LoggerWithErrors) {
  const packument = await revalidate();
  if (packument.versions[packument["dist-tags"].latest].deprecated) return;
  const maxVersion = semver.maxSatisfying(Object.keys(packument.versions), "*")!;
  return String(semver.maxSatisfying([pkg.version, semver.inc(maxVersion, "patch")!], "*"));

  async function revalidate() {
    const offline = await pacote.packument(pkg.fullNpmName, { cache: cacheDir, offline: true }).catch((reason) => {
      if (reason.code !== "ENOTCACHED") throw reason;
      return undefined;
    });
    if (offline?.versions[offline["dist-tags"].latest].deprecated) return offline;
    log.info(`Version info not cached for deprecated package ${pkg.desc}`);
    return pacote.packument(pkg.fullNpmName, { cache: cacheDir, preferOnline: true });
  }
}
