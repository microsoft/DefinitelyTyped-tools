import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { Logger, assertDefined, CachedNpmInfoClient, max } from "@definitelytyped/utils";
import * as semver from "semver";

/**
 * When we fail to publish a deprecated package, it leaves behind an entry in the time property.
 * So the keys of 'time' give the actual 'latest'.
 * If that's not equal to the expected latest, try again by bumping the patch version of the last attempt by 1.
 */
export function skipBadPublishes(pkg: NotNeededPackage, client: CachedNpmInfoClient, log: Logger) {
  // because this is called right after isAlreadyDeprecated, we can rely on the cache being up-to-date
  const info = assertDefined(client.getNpmInfoFromCache(pkg.fullEscapedNpmName));
  const notNeeded = pkg.version;
  const latest = new semver.SemVer(findActualLatest(info.time));
  if (semver.lte(notNeeded, latest)) {
    const plusOne = semver.inc(latest, "patch")!;
    log(`Deprecation of ${notNeeded} failed, instead using ${plusOne}.`);
    return new NotNeededPackage(pkg.name, pkg.libraryName, plusOne);
  }
  return pkg;
}

function findActualLatest(times: Map<string, string>) {
  const actual = max(
    [...times].filter(([version]) => version !== "modified" && version !== "created"),
    ([, a], [, b]) => (new Date(a) as never) - (new Date(b) as never)
  );
  if (!actual) {
    throw new Error("failed to find actual latest");
  }
  return actual[0];
}
