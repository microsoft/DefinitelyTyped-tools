import assert = require("assert");

import { fetchJson } from "../util/io";
import { Logger } from "../util/logging";
import { best, nAtATime, intOfString, sortObjectKeys } from "../util/util";

import { readDataFile, settings, writeDataFile } from "./common";
import { AllPackages, AnyPackage, TypeScriptVersion } from "./packages";

const versionsFilename = "versions.json";
const changesFilename = "version-changes.json";
const additionsFilename = "version-additions.json";

export default class Versions {
	static async load(): Promise<Versions> {
		return new Versions(await readDataFile("calculate-versions", versionsFilename));
	}

	/**
	 * Calculates versions and changed packages by comparing contentHash of parsed packages the NPM registry.
	 * `additions` is a subset of `changes`.
	 */
	static async determineFromNpm(allPackages: AllPackages, log: Logger, forceUpdate: boolean
		): Promise<{changes: Changes, additions: Changes, versions: Versions}> {
		const changes: Changes = [];
		const additions: Changes = [];
		const data: VersionMap = {};

		await nAtATime(25, allPackages.allTypings(), async pkg => {
			const packageName = pkg.typingsPackageName;
			const isPrerelease = TypeScriptVersion.isPrerelease(pkg.typeScriptVersion);
			const versionInfo = await fetchTypesPackageVersionInfo(pkg, isPrerelease, [pkg.libraryMajorVersion, pkg.libraryMinorVersion]);
			if (!versionInfo) {
				log(`Added: ${packageName}`);
				additions.push(packageName);
			}
			let { version, contentHash, deprecated } = versionInfo || defaultVersionInfo(isPrerelease);
			assert(!deprecated, `Package ${packageName} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
			if (forceUpdate || !versionInfo || pkg.contentHash !== contentHash) {
				log(`Changed: ${packageName}`);
				changes.push(packageName);
				version = updateVersion(version, pkg.libraryMajorVersion, pkg.libraryMinorVersion, isPrerelease);
				contentHash = pkg.contentHash;
			}
			data[packageName] = { version, contentHash, deprecated };
		});

		await nAtATime(25, allPackages.allNotNeeded(), async pkg => {
			const packageName = pkg.typingsPackageName;
			const isPrerelease = false; // Not-needed packages are never prerelease.
			let { version, contentHash, deprecated } = await fetchTypesPackageVersionInfo(pkg, isPrerelease) || defaultVersionInfo(isPrerelease);
			if (!deprecated) {
				log(`Now deprecated: ${packageName}`);
				changes.push(packageName);
				version = pkg.asOfVersion ? parseSemver(pkg.asOfVersion, isPrerelease) : { isPrerelease, major: 0, minor: 0, patch: 0 };
			}
			data[packageName] = { version, contentHash, deprecated };
		});

		// Sort keys so that versions.json is easy to read
		return { changes, additions, versions: new Versions(sortObjectKeys(data)) };

		function defaultVersionInfo(isPrerelease: boolean): VersionInfo {
			return { version: { isPrerelease, major: -1, minor: -1, patch: -1 }, contentHash: "", deprecated: false };
		}
	}

	private constructor(private data: VersionMap) {}

	save(): Promise<void> {
		return writeDataFile(versionsFilename, this.data);
	}

	versionInfo({typingsPackageName}: AnyPackage): VersionInfo {
		const info = this.data[typingsPackageName];
		if (!info) {
			throw new Error(`No version info for ${typingsPackageName}`);
		}
		return info;
	}
}

/** Version of a package published to NPM. */
export interface Semver {
	/**
	 * If true, this is `major.minor.0-next.patch`.
	 * If false, this is `major.minor.patch`.
	 */
	isPrerelease: boolean;
	major: number;
	minor: number;
	patch: number;
}

function updateVersion(prev: Semver, major: number, minor: number, isPrerelease: boolean): Semver {
	const patch = prev.major === major && prev.minor === minor && prev.isPrerelease === isPrerelease ? prev.patch + 1 : 0;
	return { isPrerelease, major, minor, patch };
}

export function versionString({ isPrerelease, major, minor, patch }: Semver): string {
	return isPrerelease ? `${major}.${minor}.0-next.${patch}` : `${major}.${minor}.${patch}`;
}

/** Returns undefined if the package does not exist. */
async function fetchTypesPackageVersionInfo(
	pkg: AnyPackage, isPrerelease: boolean, newMajorAndMinor?: [number, number]): Promise<VersionInfo | undefined> {
	return fetchVersionInfoFromNpm(pkg.fullEscapedName(), isPrerelease, newMajorAndMinor);
}

export async function fetchVersionInfoFromNpm(
	escapedPackageName: string, isPrerelease: boolean, newMajorAndMinor?: [number, number]): Promise<VersionInfo | undefined> {

	const uri = settings.npmRegistry + escapedPackageName;
	const info = await fetchJson(uri, { retries: true });

	if (info.error) {
		throw new Error(`Error getting version at ${uri}: ${info.error}`);
	}
	else if (!info["dist-tags"]) {
		// NPM returns `{}` for missing packages.
		return undefined;
	}
	else {
		const version = getVersionSemver(info, isPrerelease, newMajorAndMinor);
		const latestVersionInfo = info.versions[versionString(version)];
		assert(!!latestVersionInfo);
		const contentHash = latestVersionInfo.typesPublisherContentHash || "";
		const deprecated = !!latestVersionInfo.deprecated;
		return { version, contentHash, deprecated };
	}
}

function getVersionSemver(info: any, isPrerelease: boolean, newMajorAndMinor?: [number, number]): Semver {
	// If there's already a published package with this version, look for that first.
	if (newMajorAndMinor) {
		const [major, minor] = newMajorAndMinor;
		const patch = latestPatchMatchingMajorAndMinor(info.versions, major, minor, isPrerelease);
		if (patch !== undefined) {
			return { isPrerelease, major, minor, patch };
		}
	}
	// latest version should never be a prerelease
	return parseSemver(info["dist-tags"].latest, /*isPrerelease*/ false);
}

/** Finds the version with matching major/minor with the latest patch version. */
function latestPatchMatchingMajorAndMinor(
	versions: { [version: string]: never }, newMajor: number, newMinor: number, isPrerelease: boolean): number | undefined {

	const versionsWithTypings = Object.keys(versions).map(v => {
		const semver = tryParseSemver(v, isPrerelease);
		if (!semver) {
			return undefined;
		}
		const { major, minor, patch } = semver;
		return major === newMajor && minor === newMinor ? patch : undefined;
	}).filter(x => x !== undefined);
	return best(versionsWithTypings, (a, b) => a > b);
}

function parseSemver(semver: string, isPrerelease: boolean): Semver {
	const result = tryParseSemver(semver, isPrerelease);
	if (!result) {
		throw new Error(`Unexpected semver: ${semver}`);
	}
	return result;
}

// This must parse the output of `versionString`.
function tryParseSemver(semver: string, isPrerelease: boolean): Semver | undefined {
	// Per the semver spec <http://semver.org/#spec-item-2>:
 	// "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."
	const rgx = isPrerelease ? /^(\d+)\.(\d+)\.0-next.(\d+)$/ : /^(\d+)\.(\d+)\.(\d+)$/;
	const match = rgx.exec(semver);
	return match ? { isPrerelease, major: intOfString(match[1]), minor: intOfString(match[2]), patch: intOfString(match[3]) } : undefined;
}

// List of package names that have changed
export type Changes = string[];

/** Read all changed packages. */
export function readChanges(): Promise<Changes> {
	return readDataFile("calculate-versions", changesFilename);
}

/** Read only packages which are newly added. */
export function readAdditions(): Promise<Changes> {
	return readDataFile("calculate-versions", additionsFilename);
}

export async function writeChanges(changes: Changes, additions: Changes): Promise<void> {
	await writeDataFile(changesFilename, changes);
	await writeDataFile(additionsFilename, additions);
}

/**
 * Latest version info for a package.
 * If it needs to be published, `version` is the version to publish and `contentHash` is the new hash.
 */
export interface VersionInfo {
	/**
	 * If this package has changed, the version that we should publish.
	 * If this package has not changed, the last version.
	 */
	version: Semver;
	/** Hash of content from DefinitelyTyped. Also stored in "typesPublisherContentHash" on NPM. */
	contentHash: string;
	/** True if this package has been deprecated (is a not-needed package). */
	deprecated: boolean;
}

/** Used to store a JSON file of version info for every package. */
interface VersionMap {
	[typingsPackageName: string]: VersionInfo;
}

export async function changedPackages(allPackages: AllPackages): Promise<AnyPackage[]> {
	const changes = await readChanges();
	return changes.map(changedPackageName => allPackages.getAnyPackage(changedPackageName));
}
