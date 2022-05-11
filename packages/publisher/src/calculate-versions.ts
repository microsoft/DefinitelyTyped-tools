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
      ({ pkg: { id }, version, latestVersion }): ChangedTypingJson => ({ id, version, latestVersion })
    ),
    changedNotNeededPackages: cp.changedNotNeededPackages.map((p) => p.name),
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
    if (!(await isAlreadyDeprecated(pkg, log))) {
      // Assert that dependencies (i.e. the replacement package) exist on npm.
      // Also checked in checkNotNeededPackage().
      await pacote.manifest(pkg.libraryName, { cache: cacheDir }).catch((reason) => {
        throw reason.code === "E404"
          ? new Error(`To deprecate '@types/${pkg.name}', '${pkg.libraryName}' must exist on npm.`, { cause: reason })
          : reason;
      });
      log.info(`To be deprecated: ${pkg.name}`);
      return pkg;
    }
    return undefined;
  });
  return { changedTypings, changedNotNeededPackages };
}

async function isAlreadyDeprecated(pkg: NotNeededPackage, log: LoggerWithErrors): Promise<unknown> {
  const offline = await pacote.manifest(pkg.fullNpmName, { cache: cacheDir, offline: true }).catch((reason) => {
    if (reason.code !== "ENOTCACHED") throw reason;
    return undefined;
  });
  if (offline?.deprecated) return offline.deprecated;
  log.info(`Version info not cached for deprecated package ${pkg.desc}`);
  const online = await pacote.manifest(pkg.fullNpmName, { cache: cacheDir, preferOnline: true });
  return online.deprecated;
}
