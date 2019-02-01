import assert = require("assert");

import { LoggerWithErrors } from "../util/logging";
import { assertDefined, best, intOfString, mapDefined, mapDefinedAsync } from "../util/util";

import { readDataFile, writeDataFile } from "./common";
import { CachedNpmInfoClient, NpmInfoVersion, UncachedNpmInfoClient } from "./npm-client";
import { AllPackages, NotNeededPackage, PackageId, TypingsData } from "./packages";

const versionsFilename = "versions.json";

interface ChangedPackagesJson {
    readonly changedTypings: ReadonlyArray<ChangedTypingJson>;
    readonly changedNotNeededPackages: ReadonlyArray<string>;
}
interface ChangedTypingJson {
    readonly id: PackageId;
    readonly version: string;
    readonly latestVersion?: string;
}

export interface ChangedTyping {
    readonly pkg: TypingsData;
    /** This is the version to be published, meaning it's the version that doesn't exist yet. */
    readonly version: string;
    /** For a non-latest version, this is the latest version; publishing an old version updates the 'latest' tag and we want to change it back. */
    readonly latestVersion: string | undefined;
}

export async function readChangedPackages(allPackages: AllPackages): Promise<ChangedPackages> {
    const json = await readDataFile("calculate-versions", versionsFilename) as ChangedPackagesJson;
    return {
        changedTypings: json.changedTypings.map(({ id, version, latestVersion }): ChangedTyping =>
            ({ pkg: allPackages.getTypingsData(id), version, latestVersion })),
        changedNotNeededPackages: json.changedNotNeededPackages.map(id => allPackages.getNotNeededPackage(id)),
    };
}

export interface ChangedPackages {
    readonly changedTypings: ReadonlyArray<ChangedTyping>;
    readonly changedNotNeededPackages: ReadonlyArray<NotNeededPackage>;
}

export async function computeAndSaveChangedPackages(allPackages: AllPackages, log: LoggerWithErrors, client: CachedNpmInfoClient): Promise<ChangedPackages> {
    log.info("Computing changed packages...");
    const cp = await computeChangedPackages(allPackages, log, client);
    const json: ChangedPackagesJson = {
        changedTypings: cp.changedTypings.map(({ pkg: { id }, version, latestVersion }): ChangedTypingJson => ({ id, version, latestVersion })),
        changedNotNeededPackages: cp.changedNotNeededPackages.map(p => p.name),
    };
    await writeDataFile(versionsFilename, json);
    return cp;
}

async function computeChangedPackages(allPackages: AllPackages, log: LoggerWithErrors, client: CachedNpmInfoClient): Promise<ChangedPackages> {
    const changedTypings = await mapDefinedAsync(allPackages.allTypings(), async pkg => {
        const { version, needsPublish } = await fetchTypesPackageVersionInfo(pkg, client, /*publish*/ true, log);
        if (needsPublish) {
            log.info(`Changed: ${pkg.desc}`);
            const latestVersion = pkg.isLatest ? undefined : (await fetchTypesPackageVersionInfo(allPackages.getLatest(pkg), client, /*publish*/ true)).version;
            return { pkg, version, latestVersion };
        }
        return undefined;
    });
    const changedNotNeededPackages = await mapDefinedAsync(allPackages.allNotNeeded(), async pkg => {
        if (!await isNotNeededPackageAlreadyDeprecated(pkg, client, log)) {
            log.info(`Now deprecated: ${pkg.name}`);
            return pkg;
        }
        return undefined;
    });
    return { changedTypings, changedNotNeededPackages };
}

export async function getLatestTypingVersion(pkg: TypingsData, client: CachedNpmInfoClient): Promise<string> {
    return (await fetchTypesPackageVersionInfo(pkg, client, /*publish*/ false)).version;
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

/** Returns undefined if the package does not exist. */
interface TypesPackageVersionInfo {
    readonly version: string;
    readonly needsPublish: boolean;
}
async function fetchTypesPackageVersionInfo(pkg: TypingsData, client: CachedNpmInfoClient, canPublish: boolean, log?: LoggerWithErrors): Promise<TypesPackageVersionInfo> {
    let info = client.getNpmInfoFromCache(pkg.fullEscapedNpmName);
    let latestVersion = info && getHighestVersionForMajor(info.versions, pkg);
    let latestVersionInfo = latestVersion && assertDefined(info!.versions.get(latestVersion.versionString));
    if (!latestVersionInfo || latestVersionInfo.typesPublisherContentHash !== pkg.contentHash) {
        if (log) { log.info(`Version info not cached for ${pkg.desc}`); }
        info = await client.fetchAndCacheNpmInfo(pkg.fullEscapedNpmName);
        latestVersion = info && getHighestVersionForMajor(info.versions, pkg);
        latestVersionInfo = latestVersion && assertDefined(info!.versions.get(latestVersion.versionString));
        if (!latestVersionInfo) { return { version: versionString(pkg, /*patch*/ 0), needsPublish: true }; }
    }

    if (latestVersionInfo.deprecated) {
        // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
        assert(
            pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras",
            `Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
    }
    const needsPublish = canPublish && pkg.contentHash !== latestVersionInfo.typesPublisherContentHash;
    const patch = needsPublish ? (latestVersion!.minor === pkg.minor ? latestVersion!.patch + 1 : 0) : latestVersion!.patch;
    return { version: versionString(pkg, patch), needsPublish };
}

function versionString(pkg: TypingsData, patch: number): string {
    return new Semver(pkg.major, pkg.minor, patch).versionString;
}

async function isNotNeededPackageAlreadyDeprecated(pkg: NotNeededPackage, client: CachedNpmInfoClient, log: LoggerWithErrors): Promise<boolean> {
    const cachedInfo = client.getNpmInfoFromCache(pkg.fullEscapedNpmName);
    let latestVersion = cachedInfo && assertDefined(cachedInfo.distTags.get("latest"));
    let latestVersionInfo = cachedInfo && latestVersion && assertDefined(cachedInfo.versions.get(latestVersion));
    if (!latestVersionInfo || !latestVersionInfo.deprecated) {
        log.info(`Version info not cached for ${pkg.desc}`);
        // Since we're deprecating this package, it should have been published at least once before, so assertDefined.
        const info = assertDefined(await client.fetchAndCacheNpmInfo(pkg.fullEscapedNpmName));
        latestVersion = assertDefined(info.distTags.get("latest"));
        latestVersionInfo = assertDefined(info.versions.get(latestVersion));
    }
    return !!latestVersionInfo.deprecated;
}

export interface ProcessedNpmInfo {
    readonly version: Semver;
    readonly highestSemverVersion: Semver;
    readonly contentHash: string;
    readonly lastModified: Date;
}
/** For use by publish-registry only. */
export async function fetchAndProcessNpmInfo(escapedPackageName: string, client: UncachedNpmInfoClient): Promise<ProcessedNpmInfo> {
    const info = assertDefined(await client.fetchNpmInfo(escapedPackageName));
    const version = Semver.parse(assertDefined(info.distTags.get("latest")));
    const { distTags, versions, timeModified } = info;
    const highestSemverVersion = getLatestVersion(versions.keys());
    assert.strictEqual(highestSemverVersion.versionString, distTags.get("next"));
    const contentHash = versions.get(version.versionString)!.typesPublisherContentHash || "";
    return { version, highestSemverVersion, contentHash, lastModified: new Date(timeModified) };
}

function getLatestVersion(versions: Iterable<string>): Semver {
    return best(mapDefined(versions, v => Semver.tryParse(v)), (a, b) => a.greaterThan(b))!;
}

function getHighestVersionForMajor(versions: ReadonlyMap<string, NpmInfoVersion>, { major, minor }: TypingsData): Semver | undefined {
    const patch = latestPatchMatchingMajorAndMinor(versions.keys(), major, minor);
    return patch === undefined ? undefined : new Semver(major, minor, patch);
}

/** Finds the version with matching major/minor with the latest patch version. */
function latestPatchMatchingMajorAndMinor(versions: Iterable<string>, newMajor: number, newMinor: number): number | undefined {
    const versionsWithTypings = mapDefined(versions, v => {
        const semver = Semver.tryParse(v);
        if (!semver) {
            return undefined;
        }
        const { major, minor, patch } = semver;
        return major === newMajor && minor === newMinor ? patch : undefined;
    });
    return best(versionsWithTypings, (a, b) => a > b);
}
