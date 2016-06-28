import { AnyPackage } from "./common";
import { parseJson } from "./util";
import fetch = require("node-fetch");

export interface SearchRecord {
	// types package name
	typePackageName: string;
	// globals
	globals: string[];
	// modules
	declaredExternalModules: string[];
	// project name
	projectName: string;
	// library name
	libraryName: string;
	// downloads in the last month from NPM
	downloads: number;
}

export interface MinifiedSearchRecord {
	// types package name
	t: string;
	// globals
	g: string[];
	// modules
	m: string[];
	// project name
	p: string;
	// library name
	l: string;
	// downloads in the last month from NPM
	d: number;
}

export function minifySearchRecord(data: SearchRecord): MinifiedSearchRecord {
	return {
		t: data.typePackageName,
		g: data.globals,
		m: data.declaredExternalModules,
		p: data.projectName,
		l: data.libraryName,
		d: data.downloads
	};
}

export async function createSearchRecord(info: AnyPackage, skipDownloads: boolean): Promise<SearchRecord> {
	let downloads: number;
	if (skipDownloads) {
		downloads = -1;
	} else {
		const url = `https://api.npmjs.org/downloads/point/last-month/${info.typingsPackageName}`;
		interface NpmResult { downloads: number; }
		const text = await (await fetch(url)).text();
		const json = <NpmResult> parseJson(text);
		downloads = json.downloads || 0;
	}

	return {
		projectName: info.projectName,
		libraryName: info.libraryName,
		globals: info.globals,
		typePackageName: info.typingsPackageName,
		declaredExternalModules: info.declaredModules,
		downloads
	};
}
