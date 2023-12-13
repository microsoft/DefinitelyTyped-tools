import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { Logger, cacheDir } from "@definitelytyped/utils";
import * as pacote from "pacote";
import * as semver from "semver";

/**
 * When we fail to publish a deprecated package, it leaves behind an entry in the time property.
 * So the keys of 'time' give the actual 'latest'.
 * If that's not equal to the expected latest, try again by bumping the patch version of the last attempt by 1.
 */
export async function skipBadPublishes(pkg: NotNeededPackage, log: Logger) {
  // because this is called right after isAlreadyDeprecated, we can rely on the cache being up-to-date
  const info = await pacote.packument(pkg.name, { cache: cacheDir });
  const maxVersion = semver.maxSatisfying(Object.keys(info.versions), "*")!;
  if (semver.lte(pkg.version, maxVersion)) {
    const plusOne = semver.inc(maxVersion, "patch")!;
    log(`Deprecation of ${pkg.version} failed, instead using ${plusOne}.`);
    return new NotNeededPackage(pkg.name, pkg.libraryName, plusOne);
  }
  return pkg;
}
