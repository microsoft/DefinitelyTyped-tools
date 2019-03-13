import { assertDefined, intOfString } from "../util/util";

import { readDataFile } from "./common";
import { AllPackages, NotNeededPackage, PackageId, TypingsData } from "./packages";

export const versionsFilename = "versions.json";

export interface ChangedTyping {
    readonly pkg: TypingsData;
    /** This is the version to be published, meaning it's the version that doesn't exist yet. */
    readonly version: string;
    /** For a non-latest version, this is the latest version; publishing an old version updates the 'latest' tag and we want to change it back. */
    readonly latestVersion: string | undefined;
}

export interface ChangedPackagesJson {
    readonly changedTypings: ReadonlyArray<ChangedTypingJson>;
    readonly changedNotNeededPackages: ReadonlyArray<string>;
}

export interface ChangedTypingJson {
    readonly id: PackageId;
    readonly version: string;
    readonly latestVersion?: string;
}

export interface ChangedPackages {
    readonly changedTypings: ReadonlyArray<ChangedTyping>;
    readonly changedNotNeededPackages: ReadonlyArray<NotNeededPackage>;
}

export async function readChangedPackages(allPackages: AllPackages): Promise<ChangedPackages> {
    const json = await readDataFile("calculate-versions", versionsFilename) as ChangedPackagesJson;
    return {
        changedTypings: json.changedTypings.map(({ id, version, latestVersion }): ChangedTyping =>
            ({ pkg: allPackages.getTypingsData(id), version, latestVersion })),
        changedNotNeededPackages: json.changedNotNeededPackages.map(id => assertDefined(allPackages.getNotNeededPackage(id))),
    };
}

/** Version of a package published to NPM. */
export class Semver {
    static parse(semver: string): Semver {
        const result = Semver.tryParse(semver);
        if (!result) {
            throw new Error(`Unexpected semver: ${semver}`);
        }
        return result;
    }

    static fromRaw({ major, minor, patch }: Semver): Semver {
        return new Semver(major, minor, patch);
    }

    // This must parse the output of `versionString`.
    static tryParse(semver: string): Semver | undefined {
        // Per the semver spec <http://semver.org/#spec-item-2>:
        // "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."
        const rgx = /^(\d+)\.(\d+)\.(\d+)$/;
        const match = rgx.exec(semver);
        return match ? new Semver(intOfString(match[1]), intOfString(match[2]), intOfString(match[3])) : undefined;
    }

    constructor(readonly major: number, readonly minor: number, readonly patch: number) {}

    get versionString(): string {
        const { major, minor, patch } = this;
        return `${major}.${minor}.${patch}`;
    }

    equals(sem: Semver): boolean {
        return this.major === sem.major && this.minor === sem.minor && this.patch === sem.patch;
    }

    greaterThan(sem: Semver): boolean {
        return this.major > sem.major || this.major === sem.major
            && (this.minor > sem.minor || this.minor === sem.minor && this.patch > sem.patch);
    }
}
