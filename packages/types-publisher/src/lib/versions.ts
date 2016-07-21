import * as fs from "fs";
import * as fsp from "fs-promise";
import { createBlobFromText, readBlob } from "./azure-container";
import { settings, TypingsData } from "./common";
import { parseJson } from "./util";

const versionsFilename = "data/versions.json";
const changesFilename = "data/version-changes.txt";

export default class Versions {
	static async loadFromBlob(): Promise<Versions> {
		return new this(await (await readBlob(settings.versionsBlobName)).json());
	}

	static async loadFromLocalFile(): Promise<Versions> {
		return new Versions(parseJson(await fsp.readFile(versionsFilename, { encoding: "utf8" })));
	}

	static existsSync(): boolean {
		return fs.existsSync(versionsFilename);
	}

	private constructor(private data: VersionMap) {}

	saveLocally(): Promise<void> {
		return fsp.writeFile(versionsFilename, this.render(), { encoding: "utf8" });
	}

	upload(): Promise<void> {
		return createBlobFromText(settings.versionsBlobName, this.render());
	}

	recordUpdate(typing: TypingsData, forceUpdate: boolean): boolean {
		const {lastVersion, lastContentHash} = this.getLastVersionAndContentHash(typing);
		const shouldIncrement = forceUpdate || lastContentHash !== typing.contentHash;
		if (shouldIncrement) {
			const key = typing.typingsPackageName;
			const newVersion = lastVersion + 1;
			this.data[key] = { lastVersion: newVersion, lastContentHash: typing.contentHash };
		}
		return shouldIncrement;
	}

	getVersion(typing: TypingsData): number {
		return this.getLastVersionAndContentHash(typing).lastVersion;
	}

	private getLastVersionAndContentHash(typing: TypingsData): { lastVersion: number, lastContentHash: string } {
		return this.data[typing.typingsPackageName] || { lastVersion: 0, lastContentHash: "" };
	}

	private render() {
		return JSON.stringify(this.data, undefined, 4);
	}
}

// List of package names that have changed
export type Changes = string[];

export async function readChanges(): Promise<Changes> {
	return (await fsp.readFile(changesFilename, { encoding: "utf8" })).split("\n");
}

export function writeChanges(changes: Changes): Promise<void> {
	return fsp.writeFile(changesFilename, changes.join("\n"), { encoding: "utf8" });
}

interface VersionMap {
	[typingsPackageName: string]: {
		lastVersion: number;
		lastContentHash: string;
	};
}
