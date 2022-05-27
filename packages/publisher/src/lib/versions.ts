import { assertDefined } from "@definitelytyped/utils";
import {
  AllPackages,
  NotNeededPackage,
  PackageId,
  TypingsData,
  readDataFile,
} from "@definitelytyped/definitions-parser";

export const versionsFilename = "versions.json";

export interface ChangedTyping {
  readonly pkg: TypingsData;
  /** This is the version to be published, meaning it's the version that doesn't exist yet. */
  readonly version: string;
}

export interface ChangedPackagesJson {
  readonly changedTypings: readonly ChangedTypingJson[];
  readonly changedNotNeededPackages: readonly string[];
}

export interface ChangedTypingJson {
  readonly id: PackageId;
  readonly version: string;
}

export interface ChangedPackages {
  readonly changedTypings: readonly ChangedTyping[];
  readonly changedNotNeededPackages: readonly NotNeededPackage[];
}

export async function readChangedPackages(allPackages: AllPackages): Promise<ChangedPackages> {
  const json = (await readDataFile("calculate-versions", versionsFilename)) as ChangedPackagesJson;
  return {
    changedTypings: json.changedTypings.map(
      ({ id, version }): ChangedTyping => ({
        pkg: allPackages.getTypingsData(id),
        version,
      })
    ),
    changedNotNeededPackages: json.changedNotNeededPackages.map((id) =>
      assertDefined(allPackages.getNotNeededPackage(id))
    ),
  };
}
