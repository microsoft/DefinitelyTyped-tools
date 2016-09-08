import * as fs from "fs";
import { readJsonBlob } from "./azure-container";
import { AnyPackage, TypingsData } from "./common";
import { readFile, readJson, writeFile } from "./util";

const versionsFilename = "data/versions.json";
const changesFilename = "data/version-changes.txt";

export default class Versions {
	static async loadFromBlob(): Promise<Versions> {
		return new this(await readJsonBlob(versionsFilename));
	}

	static async loadFromLocalFile(): Promise<Versions> {
		return new Versions(await readJson(versionsFilename));
	}

	static existsSync(): boolean {
		return fs.existsSync(versionsFilename);
	}

	private constructor(private data: VersionMap) {}

	saveLocally(): Promise<void> {
		return writeFile(versionsFilename, this.render());
	}

	recordUpdate(typing: TypingsData, forceUpdate: boolean): boolean {
		const {lastVersion, lastContentHash} = this.versionInfo(typing);
		const shouldIncrement = forceUpdate || lastContentHash !== typing.contentHash;
		if (shouldIncrement) {
			const key = typing.typingsPackageName;
			const newVersion = lastVersion + 1;
			this.data[key] = { lastVersion: newVersion, lastContentHash: typing.contentHash };
		}
		return shouldIncrement;
	}

	versionInfo(typing: TypingsData): { lastVersion: number, lastContentHash: string } {
		return this.data[typing.typingsPackageName] || { lastVersion: 0, lastContentHash: "" };
	}

	private render() {
		return JSON.stringify(this.data, undefined, 4);
	}
}

// List of package names that have changed
export type Changes = string[];

async function readChanges(): Promise<Changes> {
	return (await readFile(changesFilename)).split("\n");
}

export function writeChanges(changes: Changes): Promise<void> {
	return writeFile(changesFilename, changes.join("\n"));
}

export interface VersionInfo {
	lastVersion: number;
	lastContentHash: string;
}

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
