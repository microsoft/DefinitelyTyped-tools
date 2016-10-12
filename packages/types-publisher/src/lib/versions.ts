import assert = require("assert");
import * as fs from "fs";
import { AnyPackage, TypingsData, AllPackages, fullPackageName, settings } from "./common";
import { Logger } from "./logging";
import { fetchJson, nAtATime, readFile, readJson, writeFile } from "./util";

const versionsFilename = "data/versions.json";
const changesFilename = "data/version-changes.txt";

export default class Versions {
	static async load(): Promise<Versions> {
		return new Versions(await readJson(versionsFilename));
	}

	static existsSync(): boolean {
		return fs.existsSync(versionsFilename);
	}

	/** Calculates versions and changed packages by comparing contentHash of parsed packages the NPM registry. */
	static async determineFromNpm({ typings, notNeeded }: AllPackages, log: Logger, forceUpdate: boolean): Promise<{changes: Changes, versions: Versions}> {
		const changes: Changes = [];
		const data: VersionMap = {};

		await nAtATime(25, typings, async pkg => {
			const packageName = pkg.typingsPackageName;
			let { version, contentHash, deprecated } = await fetchVersionInfoFromNpm(packageName);
			assert(!deprecated, `Package ${packageName} has been deprecated, so we shouldn't have parsed it. Was it re-added?`);
			if (forceUpdate || pkg.contentHash !== contentHash) {
				log(`Changed: ${packageName}`);
				changes.push(packageName);
				version++;
				contentHash = pkg.contentHash;
			}
			data[packageName] = { version, contentHash, deprecated };
		});

		await nAtATime(25, notNeeded, async pkg => {
			const packageName = pkg.typingsPackageName;
			let { version, contentHash, deprecated } = await fetchVersionInfoFromNpm(packageName);
			if (!deprecated) {
				log(`Now deprecated: ${packageName}`);
				changes.push(packageName);
				version++;
			}
			data[packageName] = { version, contentHash, deprecated };
		});

		return { changes, versions: new Versions(data) };
	}

	private constructor(private data: VersionMap) {}

	save(): Promise<void> {
		return writeFile(versionsFilename, this.render());
	}

	versionInfo(typing: TypingsData): VersionInfo {
		const info = this.data[typing.typingsPackageName];
		if (!info) {
			throw new Error(`No version info for ${typing.typingsPackageName}`);
		}
		return info;
	}

	private render() {
		return JSON.stringify(this.data, undefined, 4);
	}
}

async function fetchVersionInfoFromNpm(packageName: string): Promise<VersionInfo> {
	const escapedPackageName = fullPackageName(packageName).replace(/\//g, "%2f");
	const uri = settings.npmRegistry + escapedPackageName;
	const info = await fetchJson(uri);

	if (info.error) {
		if (info.error === "Not found") {
			return { version: 0, contentHash: "", deprecated: false };
		}
		else {
			throw new Error(`Error getting version of ${packageName}: ${info.error}`);
		}
	}
	else {
		const versionSemver: string = info["dist-tags"].latest;
		assert(typeof versionSemver === "string");
		const latestVersionInfo = info.versions[versionSemver];
		assert(!!latestVersionInfo);
		const contentHash = latestVersionInfo.typesPublisherContentHash || "";
		const deprecated = !!latestVersionInfo.deprecated;
		return { version: versionNumberFromSemver(versionSemver), contentHash, deprecated };
	}
}

function versionNumberFromSemver(semver: string): number {
	const rgx = /^\d+\.\d+\.(\d+)$/;
	const match = rgx.exec(semver);
	if (!match) {
		throw new Error(`Unexpected semver: ${semver}`);
	}
	return Number.parseInt(match[1], 10);
}

// List of package names that have changed
export type Changes = string[];

async function readChanges(): Promise<Changes> {
	return (await readFile(changesFilename)).split("\n");
}

export function writeChanges(changes: Changes): Promise<void> {
	return writeFile(changesFilename, changes.join("\n"));
}

/** Latest version info for a package.
 * If it needs to be published, `version` is the version to publish and `contentHash` is the new hash.
 */
export interface VersionInfo {
	/** Semver patch version. */
	version: number;
	/** Hash of content from DefinitelyTyped. Also stored in "typesPublisherContentHash" on NPM. */
	contentHash: string;
	/** True if this package has been deprecated (is a not-needed package). */
	deprecated: boolean;
}

/** Used to store a JSON file of version info for every package. */
interface VersionMap {
	[typingsPackageName: string]: VersionInfo;
}

export async function changedPackages(allPackages: AnyPackage[]): Promise<AnyPackage[]> {
	const changes = await readChanges();
	return changes.map(changedPackageName => {
		const pkg = allPackages.find(p => p.typingsPackageName === changedPackageName);
		if (pkg === undefined) {
			throw new Error(`Expected to find a package named ${changedPackageName}`);
		}
		return pkg;
	});
}
