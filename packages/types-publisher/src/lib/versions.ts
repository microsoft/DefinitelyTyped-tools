import assert = require("assert");

import { fetchJson } from "../util/io";
import { Logger } from "../util/logging";
import { best, nAtATime, intOfString, sortObjectKeys } from "../util/util";

import { readDataFile, settings, writeDataFile } from "./common";
import { AllPackages, AnyPackage, PackageId, MajorMinor, NotNeededPackage, TypeScriptVersion, TypingsData } from "./packages";

const versionsFilename = "versions.json";
const changesFilename = "version-changes.json";
const additionsFilename = "version-additions.json";

export default class Versions {
	static async load(): Promise<Versions> {
		const raw: VersionMap = await readDataFile("calculate-versions", versionsFilename);
		for (const packageName in raw) {
			const majorVersions = raw[packageName];
			for (const majorVersion in majorVersions) {
				majorVersions[majorVersion].version = Semver.fromRaw(majorVersions[majorVersion].version);
			}
		}
		return new Versions(raw);
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

		await nAtATime(25, allPackages.allTypings(), getTypingsVersion, { name: "Versions for typings", flavor });
		async function getTypingsVersion(pkg: TypingsData) {
			const isPrerelease = TypeScriptVersion.isPrerelease(pkg.typeScriptVersion);
			const versionInfo = await fetchTypesPackageVersionInfo(pkg, isPrerelease, pkg.majorMinor);
			if (!versionInfo) {
				log(`Added: ${pkg.desc}`);
				additions.push(pkg.id);
			}
			let { version, contentHash, deprecated } = versionInfo || defaultVersionInfo(isPrerelease);
			assert(!deprecated, `Package ${pkg.name} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
			if (forceUpdate || !versionInfo || pkg.contentHash !== contentHash) {
				log(`Changed: ${pkg.desc}`);
				changes.push(pkg.id);
				version = version.update(pkg.majorMinor, isPrerelease);
				contentHash = pkg.contentHash;
			}
			addToData(pkg.name, version, contentHash, deprecated);
		}

		await nAtATime(25, allPackages.allNotNeeded(), getNotNeededVersion, { name: "Versions for not-needed packages...", flavor });
		async function getNotNeededVersion(pkg: NotNeededPackage) {
			const isPrerelease = false; // Not-needed packages are never prerelease.
			let { version, contentHash, deprecated } = await fetchTypesPackageVersionInfo(pkg, isPrerelease) || defaultVersionInfo(isPrerelease);
			if (!deprecated) {
				log(`Now deprecated: ${pkg.name}`);
				changes.push({ name: pkg.name, majorVersion: version.major });
				version = pkg.version;
			}
			addToData(pkg.name, version, contentHash, deprecated);
		}

		function flavor(pkg: AnyPackage): string { return pkg.desc; }

		// Sort keys so that versions.json is easy to read
		return { changes, additions, versions: new Versions(sortObjectKeys(data)) };

		function defaultVersionInfo(isPrerelease: boolean): VersionInfo {
			return { version: new Semver(-1, -1, -1, isPrerelease), contentHash: "", deprecated: false };
		}

		function addToData(packageName: string, version: Semver, contentHash: string, deprecated: boolean) {
			let majorVersions = data[packageName];
			if (!majorVersions) {
				majorVersions = data[packageName] = {};
			}

			assert(!majorVersions[version.major]);
			majorVersions[version.major] = { version, contentHash, deprecated };
		}
	}

	private constructor(private data: VersionMap) {}

	save(): Promise<void> {
		return writeDataFile(versionsFilename, this.data);
	}

	getVersion({name, majorVersion}: PackageId): Semver {
		const info = this.data[name][majorVersion];
		if (!info) {
			throw new Error(`No version info for ${name}`);
		}
		return info.version;
	}
}

export async function changedPackages(allPackages: AllPackages): Promise<AnyPackage[]> {
	const changes = await readChanges();
	return changes.map(changedPackageName => allPackages.getAnyPackage(changedPackageName));
}

/** Version of a package published to NPM. */
export class Semver {
	static parse(semver: string, isPrerelease: boolean): Semver {
		const result = Semver.tryParse(semver, isPrerelease);
		if (!result) {
			throw new Error(`Unexpected semver: ${semver}`);
		}
		return result;
	}

	static fromRaw({ major, minor, patch, isPrerelease }: Semver) {
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

	update({ major, minor }: MajorMinor, isPrerelease: boolean): Semver {
		const patch = this.major === major && this.minor === minor && this.isPrerelease === isPrerelease ? this.patch + 1 : 0;
		return new Semver(major, minor, patch, isPrerelease);
	}
}

/** Returns undefined if the package does not exist. */
async function fetchTypesPackageVersionInfo(pkg: AnyPackage, isPrerelease: boolean, newMajorAndMinor?: MajorMinor): Promise<VersionInfo | undefined> {
	return fetchVersionInfoFromNpm(pkg.fullEscapedNpmName, isPrerelease, newMajorAndMinor);
}

export async function fetchVersionInfoFromNpm(
	escapedPackageName: string, isPrerelease: boolean, newMajorAndMinor?: MajorMinor): Promise<VersionInfo | undefined> {

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
		const latestVersionInfo = info.versions[version.versionString];
		assert(!!latestVersionInfo);
		const contentHash = latestVersionInfo.typesPublisherContentHash || "";
		const deprecated = !!latestVersionInfo.deprecated;
		return { version, contentHash, deprecated };
	}
}

function getVersionSemver(info: any, isPrerelease: boolean, newMajorAndMinor?: MajorMinor): Semver {
	// If there's already a published package with this version, look for that first.
	if (newMajorAndMinor) {
		const { major, minor } = newMajorAndMinor;
		const patch = latestPatchMatchingMajorAndMinor(info.versions, major, minor, isPrerelease);
		if (patch !== undefined) {
			return new Semver(major, minor, patch, isPrerelease);
		}
	}
	// latest version should never be a prerelease
	return Semver.parse(info["dist-tags"].latest, /*isPrerelease*/ false);
}

/** Finds the version with matching major/minor with the latest patch version. */
function latestPatchMatchingMajorAndMinor(
	versions: { [version: string]: never }, newMajor: number, newMinor: number, isPrerelease: boolean): number | undefined {

	const versionsWithTypings = Object.keys(versions).map(v => {
		const semver = Semver.tryParse(v, isPrerelease);
		if (!semver) {
			return undefined;
		}
		const { major, minor, patch } = semver;
		return major === newMajor && minor === newMinor ? patch : undefined;
	}).filter(x => x !== undefined);
	return best(versionsWithTypings, (a, b) => a > b);
}

// List of packages that have changed
export type Changes = PackageId[];

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
interface VersionInfo {
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
	[packageName: string]: { [version: string]: VersionInfo };
}
