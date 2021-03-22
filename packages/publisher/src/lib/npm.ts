import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { Logger, assertDefined, Semver, best, CachedNpmInfoClient } from "@definitelytyped/utils";

/**
 * When we fail to publish a deprecated package, it leaves behind an entry in the time property.
 * So the keys of 'time' give the actual 'latest'.
 * If that's not equal to the expected latest, try again by bumping the patch version of the last attempt by 1.
 */
export function skipBadPublishes(pkg: NotNeededPackage, client: CachedNpmInfoClient, log: Logger) {
  // because this is called right after isAlreadyDeprecated, we can rely on the cache being up-to-date
  const info = assertDefined(client.getNpmInfoFromCache(pkg.fullEscapedNpmName));
  const notNeeded = pkg.version;
  const latest = Semver.parse(findActualLatest(info.time));
  if (
    latest.equals(notNeeded) ||
    latest.greaterThan(notNeeded) ||
    (info.versions.has(notNeeded.versionString) &&
      !assertDefined(info.versions.get(notNeeded.versionString)).deprecated)
  ) {
    const plusOne = new Semver(latest.major, latest.minor, latest.patch + 1);
    log(`Deprecation of ${notNeeded.versionString} failed, instead using ${plusOne.versionString}.`);
    return new NotNeededPackage(pkg.name, {
      ...pkg,
      asOfVersion: plusOne.versionString
    });
  }
  return pkg;
}

function findActualLatest(times: Map<string, string>) {
  const actual = best(times, ([k, v], [bestK, bestV]) =>
    bestK === "modified" || bestK === "created"
      ? true
      : k === "modified" || k === "created"
      ? false
      : new Date(v).getTime() > new Date(bestV).getTime()
  );
  if (!actual) {
    throw new Error("failed to find actual latest");
  }
  return actual[0];
}
