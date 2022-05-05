import { assertDefined } from "@definitelytyped/utils";
import { AllPackages, NotNeededPackage, TypingsData, readDataFile } from "@definitelytyped/definitions-parser";
import * as semver from "semver";

export const versionsFilename = "versions.json";

export interface ChangedTyping<T> {
  readonly pkg: T;
  /** This is the version to be published, meaning it's the version that doesn't exist yet. */
  readonly version: string;
  /** For a non-latest version, this is the latest version; publishing an old version updates the 'latest' tag and we want to change it back. */
  readonly latestVersion?: string;
}

export interface ChangedPackagesJson {
  readonly changedTypings: readonly ChangedTypingJson[];
  readonly changedNotNeededPackages: readonly ChangedTypingJson[];
}

export interface ChangedTypingJson {
  readonly name: string;
  readonly version: string;
  readonly latestVersion?: string;
}

export interface ChangedPackages {
  readonly changedTypings: readonly ChangedTyping<TypingsData>[];
  readonly changedNotNeededPackages: readonly ChangedTyping<NotNeededPackage>[];
}

export async function readChangedPackages(allPackages: AllPackages): Promise<ChangedPackages> {
  const json = (await readDataFile("calculate-versions", versionsFilename)) as ChangedPackagesJson;
  return {
    changedTypings: json.changedTypings.map(
      ({ name, version, latestVersion }): ChangedTyping<TypingsData> => ({
        pkg: allPackages.getTypingsData({ name, version: new semver.SemVer(version) }),
        version,
        latestVersion,
      })
    ),
    changedNotNeededPackages: json.changedNotNeededPackages.map(({ name, version }) => ({
      pkg: assertDefined(allPackages.getNotNeededPackage(name)),
      version,
    })),
  };
}
