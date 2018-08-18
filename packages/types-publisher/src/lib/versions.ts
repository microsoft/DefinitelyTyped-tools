import assert = require("assert");
import { TypeScriptVersion } from "definitelytyped-header-parser";

import { Fetcher, sleep } from "../util/io";
import { Logger } from "../util/logging";
import { assertDefined, best, intOfString, nAtATime, sortObjectKeys } from "../util/util";

import { Options, readDataFile, writeDataFile } from "./common";
import { fetchNpmInfo, NpmInfo, NpmInfoVersions } from "./npm-client";
import { AllPackages, AnyPackage, MajorMinor, NotNeededPackage, PackageId } from "./packages";

const versionsFilename = "versions.json";
const changesFilename = "version-changes.json";

export default class Versions {
	static async load(): Promise<Versions> {
		const raw: VersionMap = await readDataFile("calculate-versions", versionsFilename);
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
		fetcher: Fetcher,
		options: Options,
	): Promise<{changes: Changes, versions: Versions}> {
		const changes: Changes = [];
		const data: VersionMap = {};

		for (const pkg of allPackages.allTypings()) {
			const isPrerelease = TypeScriptVersion.isPrerelease(pkg.typeScriptVersion);
			const versionInfo = await fetchTypesPackageVersionInfo(pkg, fetcher, isPrerelease, pkg.majorMinor);
			if (!versionInfo) {
				log(`Added: ${pkg.desc}`);
			}
			// tslint:disable-next-line:prefer-const
			let { version, latestNonPrerelease, contentHash, deprecated } = versionInfo || defaultVersionInfo(isPrerelease);
			if (deprecated) {
				// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
				assert(
					pkg.name === "angular-ui-router" || pkg.name === "ui-router-extras",
					`Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
			}
			if (forceUpdate || !versionInfo || pkg.major !== version.major || pkg.minor !== version.minor || pkg.contentHash !== contentHash) {
				log(`Changed: ${pkg.desc}`);
				changes.push(pkg.id);
				version = version.update(pkg.majorMinor, isPrerelease);
			}
			addToData(pkg.name, version, latestNonPrerelease);
			await sleep(0.1);
		}

		await nAtATime(options.fetchParallelism, allPackages.allNotNeeded(), getNotNeededVersion, {
			name: "Versions for not-needed packages...",
			flavor,
			options,
		});
		async function getNotNeededVersion(pkg: NotNeededPackage): Promise<void> {
			const isPrerelease = false; // Not-needed packages are never prerelease.
			// tslint:disable-next-line:prefer-const
			let { version, deprecated } = await fetchTypesPackageVersionInfo(pkg, fetcher, isPrerelease) || defaultVersionInfo(isPrerelease);
			if (!deprecated) {
				log(`Now deprecated: ${pkg.name}`);
				changes.push({ name: pkg.name, majorVersion: version.major });
				version = pkg.version;
			}
			addToData(pkg.name, version);
		}

		function flavor(pkg: AnyPackage): string { return pkg.desc; }

		// Sort keys so that versions.json is easy to read
		return { changes, versions: new Versions(sortObjectKeys(data)) };

		function defaultVersionInfo(isPrerelease: boolean): VersionInfo {
			return { version: new Semver(-1, -1, -1, isPrerelease), latestNonPrerelease: undefined, contentHash: "", deprecated: false };
		}

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
		return new Semver(pkg.major, pkg.minor, this.info(pkg.id).patch, pkg.isPrerelease);
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

export async function changedPackages(allPackages: AllPackages): Promise<ReadonlyArray<AnyPackage>> {
	const changes = await readChanges();
	return changes.map(changedPackageName => allPackages.getAnyPackage(changedPackageName));
}

/** Version of a package published to NPM. */
export class Semver {
	static parse(semver: string, isPrerelease: boolean): Semver {
		const result = Semver.tryParse(semver, isPrerelease);
		if (!result) {
			throw new Error(`Unexpected semver: ${semver} (isPrerelease: ${isPrerelease})`);
		}
		return result;
	}

	static fromRaw({ major, minor, patch, isPrerelease }: Semver): Semver {
		return new Semver(major, minor, patch, isPrerelease);
	}

	// This must parse the output of `versionString`.
	static tryParse(semver: string, isPrerelease: boolean): Semver | undefined {
		// Per the semver spec <http://semver.org/#spec-item-2>:
		// "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."
		const rgx = isPrerelease ? /^(\d+)\.(\d+)\.0-next.(\d+)$/ : /^(\d+)\.(\d+)\.(\d+)$/;
		const match = rgx.exec(semver);
		return match ? new Semver(intOfString(match[1]), intOfString(match[2]), intOfString(match[3]), isPrerelease) : undefined;
	}

	constructor(
		readonly major: number, readonly minor: number, readonly patch: number,
		/**
		 * If true, this is `major.minor.0-next.patch`.
		 * If false, this is `major.minor.patch`.
		 */
		readonly isPrerelease: boolean) {}

	get versionString(): string {
		const { isPrerelease, major, minor, patch } = this;
		return isPrerelease ? `${major}.${minor}.0-next.${patch}` : `${major}.${minor}.${patch}`;
	}

	equals(sem: Semver): boolean {
		return this.major === sem.major && this.minor === sem.minor && this.patch === sem.patch && this.isPrerelease === sem.isPrerelease;
	}

	greaterThan(sem: Semver): boolean {
		return this.major > sem.major || this.major === sem.major
			&& (this.minor > sem.minor || this.minor === sem.minor && this.patch > sem.patch);
	}

	update({ major, minor }: MajorMinor, isPrerelease: boolean): Semver {
		const patch = this.major === major && this.minor === minor && this.isPrerelease === isPrerelease ? this.patch + 1 : 0;
		return new Semver(major, minor, patch, isPrerelease);
	}
}

/** Returns undefined if the package does not exist. */
async function fetchTypesPackageVersionInfo(
	pkg: AnyPackage,
	fetcher: Fetcher,
	isPrerelease: boolean,
	newMajorAndMinor?: MajorMinor,
): Promise<VersionInfo | undefined> {
	return fetchVersionInfoFromNpm(pkg.fullEscapedNpmName, fetcher, isPrerelease, newMajorAndMinor);
}

export interface ProcessedNpmInfo {
	readonly version: Semver;
	readonly highestSemverVersion: Semver;
	readonly contentHash: string;
	readonly lastModified: Date;
}
/** For use by publish-registry only. */
export async function fetchAndProcessNpmInfo(escapedPackageName: string, fetcher: Fetcher): Promise<ProcessedNpmInfo> {
	const info = assertDefined(await fetchNpmInfo(escapedPackageName, fetcher));
	const version = getVersionSemver(info, /*isPrerelease*/ false);
	const { "dist-tags": distTags, versions, time } = info;
	const highestSemverVersion = getLatestVersion(versions);
	assert.equal(highestSemverVersion.versionString, distTags.next);
	const contentHash = versions[version.versionString].typesPublisherContentHash || "";
	return { version, highestSemverVersion, contentHash, lastModified: new Date(time.modified) };
}

async function fetchVersionInfoFromNpm(
	escapedPackageName: string,
	fetcher: Fetcher,
	isPrerelease: boolean,
	newMajorAndMinor?: MajorMinor,
): Promise<VersionInfo | undefined> {
	const info = await fetchNpmInfo(escapedPackageName, fetcher);
	if (info === undefined) { return undefined; }

	const { versions } = info;
	const latestNonPrerelease = !isPrerelease ? undefined : getLatestVersion(versions);
	const version = getVersionSemver(info, isPrerelease, newMajorAndMinor);
	const latestVersionInfo = versions[version.versionString];
	assert(!!latestVersionInfo);
	const contentHash = latestVersionInfo.typesPublisherContentHash || "";
	const deprecated = !!latestVersionInfo.deprecated;
	return { version, latestNonPrerelease, contentHash, deprecated };
}

function getLatestVersion(versions: NpmInfoVersions): Semver {
	return best(Object.keys(versions).map(parseAnySemver), (a, b) => {
		if (a.isPrerelease && !b.isPrerelease) { return false; }
		if (!a.isPrerelease && b.isPrerelease) { return true; }
		return a.greaterThan(b);
	})!;
}

function getVersionSemver(info: NpmInfo, isPrerelease: boolean, newMajorAndMinor?: MajorMinor): Semver {
	// If there's already a published package with this version, look for that first.
	if (newMajorAndMinor) {
		const { major, minor } = newMajorAndMinor;
		const patch = latestPatchMatchingMajorAndMinor(info.versions, major, minor, isPrerelease);
		if (patch !== undefined) {
			return new Semver(major, minor, patch, isPrerelease);
		}
	}
	// Usually latest version should never be a prerelease, but it may if we've only ever published prerelease versions.
	return parseAnySemver(info["dist-tags"].latest);
}

/** Parse a semver that may not follow X.Y.Z format perfectly. */
function parseAnySemver(s: string): Semver {
	// Once upon a time we published -alpha versions.
	const alpha = /^(.*)-alpha/.exec(s);
	if (alpha) {
		return Semver.parse(alpha[1], /*isPrerelase*/false);
	} else if (/^(.*)-next.\d+/.test(s)) {
		return Semver.parse(s, /*isPrerelease*/ true);
	} else {
		return Semver.parse(s, /*isPrerelease*/false);
	}
}

/** Finds the version with matching major/minor with the latest patch version. */
function latestPatchMatchingMajorAndMinor(
	versions: NpmInfo["versions"], newMajor: number, newMinor: number, isPrerelease: boolean): number | undefined {

	const versionsWithTypings = Object.keys(versions).map(v => {
		const semver = Semver.tryParse(v, isPrerelease);
		if (!semver) {
			return undefined;
		}
		const { major, minor, patch } = semver;
		return major === newMajor && minor === newMinor ? patch : undefined;
	}).filter(x => x !== undefined) as number[];
	return best(versionsWithTypings, (a, b) => a > b);
}

// List of packages that have changed
export type Changes = PackageId[];

/** Read all changed packages. */
export function readChanges(): Promise<Changes> {
	return readDataFile("calculate-versions", changesFilename);
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

	/** Latest version that was not a prerelease. Omitted if this is not itself a prerelease. */
	readonly latestNonPrerelease?: Semver;

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
