import assert = require("assert");

import { Logger } from "../util/logging";
import { assertDefined, best, intOfString, mapDefined, sortObjectKeys } from "../util/util";

import { readDataFile, writeDataFile } from "./common";
import { CachedNpmInfoClient, NpmInfo, UncachedNpmInfoClient } from "./npm-client";
import { AllPackages, AnyPackage, MajorMinor, PackageId } from "./packages";

const versionsFilename = "versions.json";
const changesFilename = "version-changes.json";

export interface VersionsAndChanges {
	readonly versions: Versions;
	readonly changes: Changes;
}

export default class Versions {
	static async load(): Promise<Versions> {
		const raw = await readDataFile("calculate-versions", versionsFilename) as VersionMap;
		for (const packageName in raw) {
			const majorVersions = raw[packageName];
			for (const majorVersion in majorVersions) {
				const info = majorVersions[majorVersion];
				if (info.latestNonPrerelease) {
					info.latestNonPrerelease = Semver.fromRaw(info.latestNonPrerelease);
				}
			}
		}
		return new Versions(raw);
	}

	/**
	 * Calculates versions and changed packages by comparing contentHash of parsed packages the NPM registry.
	 */
	static async determineFromNpm(
		allPackages: AllPackages,
		log: Logger,
		forceUpdate: boolean,
		client: CachedNpmInfoClient,
	): Promise<VersionsAndChanges> {
		const changes: Changes = [];
		const data: VersionMap = {};

		for (const pkg of allPackages.allTypings()) {
			const versionInfo = await fetchTypesPackageVersionInfo(pkg, client, pkg.majorMinor);
			if (!versionInfo) {
				log(`Added: ${pkg.desc}`);
			}
			// tslint:disable-next-line:prefer-const
			let { version, contentHash, deprecated } = versionInfo || defaultVersionInfo;
			if (deprecated) {
				// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
				assert(
					pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras",
					`Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
			}
			if (forceUpdate || !versionInfo || pkg.major !== version.major || pkg.minor !== version.minor || pkg.contentHash !== contentHash) {
				log(`Changed: ${pkg.desc}`);
				changes.push(pkg.id);
				version = version.update(pkg.majorMinor);
			}
			addToData(pkg.name, version);
		}

		for (const pkg of allPackages.allNotNeeded()) {
			// tslint:disable-next-line:prefer-const
			let { version, deprecated } = await fetchTypesPackageVersionInfo(pkg, client) || defaultVersionInfo;
			if (!deprecated) {
				log(`Now deprecated: ${pkg.name}`);
				changes.push({ name: pkg.name, majorVersion: version.major });
				version = pkg.version;
			}
			addToData(pkg.name, version);
		}

		// Sort keys so that versions.json is easy to read
		return { versions: new Versions(sortObjectKeys(data)), changes };

		function addToData(packageName: string, { major, patch }: Semver, latestNonPrerelease?: Semver): void {
			let majorVersions = data[packageName];
			if (!majorVersions) {
				majorVersions = data[packageName] = {};
			}
			assert(!majorVersions[major]);
			majorVersions[major] = latestNonPrerelease ? { patch, latestNonPrerelease } : { patch };
		}
	}

	private constructor(private readonly data: VersionMap) {}

	save(): Promise<void> {
		return writeDataFile(versionsFilename, this.data);
	}

	getVersion(pkg: AnyPackage): Semver {
		return new Semver(pkg.major, pkg.minor, this.info(pkg.id).patch);
	}

	latestNonPrerelease(pkg: AnyPackage): Semver {
		const info = this.info(pkg.id);
		return pkg.isLatest ? this.getVersion(pkg) : assertDefined(info.latestNonPrerelease);
	}

	private info({name, majorVersion}: PackageId): VersionData {
		const info = this.data[name][majorVersion];
		if (!info) {
			throw new Error(`No version info for ${name}@${majorVersion}`);
		}
		return info;
	}
}

export async function changedPackages(allPackages: AllPackages, changes: ReadonlyArray<PackageId>): Promise<ReadonlyArray<AnyPackage>> {
	return changes.map(changedPackageName => allPackages.getAnyPackage(changedPackageName));
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

	update({ major, minor }: MajorMinor): Semver {
		const patch = this.major === major && this.minor === minor ? this.patch + 1 : 0;
		return new Semver(major, minor, patch);
	}
}

const defaultVersionInfo: VersionInfo = { version: new Semver(-1, -1, -1), contentHash: "", deprecated: false };

/** Returns undefined if the package does not exist. */
async function fetchTypesPackageVersionInfo(
	pkg: AnyPackage,
	client: CachedNpmInfoClient,
	newMajorAndMinor?: MajorMinor,
): Promise<VersionInfo | undefined> {
	const info = await client.getNpmInfo(pkg.fullEscapedNpmName, pkg.isNotNeeded() ? undefined : pkg.contentHash);
	if (info === undefined) { return undefined; }

	const { versions } = info;
	const version = getVersionSemver(info, newMajorAndMinor);
	const latestVersionInfo = assertDefined(versions.get(version.versionString));
	const contentHash = latestVersionInfo.typesPublisherContentHash || "";
	const deprecated = !!latestVersionInfo.deprecated;
	return { version, contentHash, deprecated };
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
	const version = getVersionSemver(info);
	const { distTags, versions, timeModified } = info;
	const highestSemverVersion = getLatestVersion(versions.keys());
	assert.strictEqual(highestSemverVersion.versionString, distTags.get("next"));
	const contentHash = versions.get(version.versionString)!.typesPublisherContentHash || "";
	return { version, highestSemverVersion, contentHash, lastModified: new Date(timeModified) };
}

function getLatestVersion(versions: Iterable<string>): Semver {
	return best(mapDefined(versions, v => Semver.tryParse(v)), (a, b) => a.greaterThan(b))!;
}

function getVersionSemver(info: NpmInfo, newMajorAndMinor?: MajorMinor): Semver {
	// If there's already a published package with this version, look for that first.
	if (newMajorAndMinor) {
		const { major, minor } = newMajorAndMinor;
		const patch = latestPatchMatchingMajorAndMinor(info.versions.keys(), major, minor);
		if (patch !== undefined) {
			return new Semver(major, minor, patch);
		}
	}
	return Semver.parse(assertDefined(info.distTags.get("latest")));
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

export async function readVersionsAndChanges(): Promise<VersionsAndChanges> {
	return { versions: await Versions.load(), changes: await readChanges() };
}

// List of packages that have changed
export type Changes = PackageId[];

/** Read all changed packages. */
export function readChanges(): Promise<Changes> {
	return readDataFile("calculate-versions", changesFilename) as Promise<Changes>;
}

export async function writeChanges(changes: Changes): Promise<void> {
	await writeDataFile(changesFilename, changes);
}

/**
 * Latest version info for a package. Used to calculate versions.
 * If it needs to be published, `version` is the version to publish and `contentHash` is the new hash.
 */
interface VersionInfo {
	/**
	 * If this package has changed, the version that we should publish.
	 * If this package has not changed, the last version.
	 */
	readonly version: Semver;

	/** Hash of content from DefinitelyTyped. Also stored in "typesPublisherContentHash" on NPM. */
	readonly contentHash: string;

	/** True if this package has been deprecated (is a not-needed package). */
	readonly deprecated: boolean;
}

/** Stores the result of calculating a package's version. */
interface VersionData {
	readonly patch: number;
	latestNonPrerelease?: Semver;
}

/** Used to store a JSON file of version info for every package. */
interface VersionMap {
	[packageName: string]: { [version: string]: VersionData };
}
