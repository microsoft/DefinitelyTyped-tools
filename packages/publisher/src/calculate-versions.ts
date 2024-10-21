import process from "process";
import { defaultLocalOptions, defaultRemoteOptions } from "./lib/common";
import { ChangedPackages, ChangedPackagesJson, ChangedTypingJson, versionsFilename } from "./lib/versions";
import { getDefinitelyTyped, AllPackages, NotNeededPackage, writeDataFile } from "@definitelytyped/definitions-parser";
import {
  logUncaughtErrors,
  loggerWithErrors,
  FS,
  LoggerWithErrors,
  cacheDir,
  nAtATime,
  compact,
  isTypesPackageName,
  mustTrimAtTypesPrefix,
} from "@definitelytyped/utils";
import { fetchTypesPackageVersionInfo } from "@definitelytyped/retag";
import * as pacote from "pacote";
import yargs = require("yargs");

const npmRegistryParallelism = 10;

if (require.main === module) {
  const log = loggerWithErrors()[0];
  const options = { ...defaultLocalOptions };
  const argv = yargs.parseSync();
  if (argv.path) {
    options.definitelyTypedPath = argv.path as string;
  }
  logUncaughtErrors(async () =>
    calculateVersions(await getDefinitelyTyped(process.env.GITHUB_ACTIONS ? defaultRemoteOptions : options, log), log),
  );
}

export default async function calculateVersions(dt: FS, log: LoggerWithErrors): Promise<ChangedPackages> {
  log.info("=== Calculating versions ===");
  log.info("* Reading packages...");
  const packages = AllPackages.fromFS(dt);
  return computeAndSaveChangedPackages(packages, log);
}

async function computeAndSaveChangedPackages(
  allPackages: AllPackages,
  log: LoggerWithErrors,
): Promise<ChangedPackages> {
  const cp = await computeChangedPackages(allPackages, log);
  const json: ChangedPackagesJson = {
    changedTypings: cp.changedTypings.map(
      ({ pkg: { id }, version, latestVersion }): ChangedTypingJson => ({ id, version, latestVersion }),
    ),
    changedNotNeededPackages: cp.changedNotNeededPackages.map((p) => p.typesDirectoryName),
  };
  await writeDataFile(versionsFilename, json);
  return cp;
}

async function computeChangedPackages(allPackages: AllPackages, log: LoggerWithErrors): Promise<ChangedPackages> {
  log.info("# Computing changed packages...");
  const changedTypings = await nAtATime(npmRegistryParallelism, await allPackages.allTypings(), async (pkg) => {
    const { version, needsPublish } = await fetchTypesPackageVersionInfo(pkg, /*publish*/ true, log);
    if (needsPublish) {
      log.info(`Need to publish: ${pkg.desc}@${version}`);
      for (const name of Object.keys(pkg.dependencies).concat(Object.keys(pkg.peerDependencies))) {
        // Assert that dependencies exist on npm.
        // Also checked when we install the dependencies, in dtslint-runner.

        // If we're publishing interdependent types packages, this will fail as
        // we haven't published them yet. Skip for any packages which are
        // definitely within the repo.
        // TODO: This could verify the version range is correct, but just checks for existence for now.
        if (isTypesPackageName(name) && (await allPackages.tryGetLatestVersion(mustTrimAtTypesPrefix(name)))) {
          continue;
        }

        await pacote.manifest(name, { cache: cacheDir }).catch((reason) => {
          throw reason.code === "E404"
            ? new Error(
                `'${pkg.name}' depends on '${name}' which does not exist on npm. All dependencies must exist.`,
                { cause: reason },
              )
            : reason;
        });
      }
      const latestVersion = pkg.isLatest
        ? undefined
        : (await fetchTypesPackageVersionInfo(await allPackages.getLatest(pkg), /*publish*/ true)).version;
      return { pkg, version, latestVersion };
    }
    return undefined;
  });
  log.info("# Computing deprecated packages...");
  const changedNotNeededPackages = await nAtATime(npmRegistryParallelism, allPackages.allNotNeeded(), async (pkg) => {
    if (!(await isAlreadyDeprecated(pkg, log))) {
      // Assert that dependencies (i.e. the replacement package) exist on npm.
      // Also checked in checkNotNeededPackage().
      await pacote.manifest(pkg.libraryName, { cache: cacheDir }).catch((reason) => {
        throw reason.code === "E404"
          ? new Error(`To deprecate '${pkg.name}', '${pkg.libraryName}' must exist on npm.`, { cause: reason })
          : reason;
      });
      log.info(`To be deprecated: ${pkg.name}`);
      return pkg;
    }
    return undefined;
  });
  const errors = allPackages.getErrorsAsArray();
  if (errors.length) {
    throw new Error(`Cannot determine if packages with errors need to be published:\n\n${errors.join("\n")}`);
  }
  return { changedTypings: compact(changedTypings), changedNotNeededPackages: compact(changedNotNeededPackages) };
}

async function isAlreadyDeprecated(pkg: NotNeededPackage, log: LoggerWithErrors): Promise<unknown> {
  const offline = await pacote.manifest(pkg.name, { cache: cacheDir, offline: true }).catch((reason) => {
    if (reason.code !== "ENOTCACHED") throw reason;
    return undefined;
  });
  if (offline?.deprecated) return offline.deprecated;
  log.info(`Version info not cached for deprecated package ${pkg.desc}`);
  const online = await pacote.manifest(pkg.name, { cache: cacheDir, preferOnline: true });
  return online.deprecated;
}
