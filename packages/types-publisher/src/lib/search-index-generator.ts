import { TypingsData } from "./common";
import * as request from "request";

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

function createSearchRecord(info: TypingsData, downloads: number): SearchRecord {
	return ({
		projectName: info.projectName,
		libraryName: info.libraryName,
		globals: info.globals,
		typePackageName: info.typingsPackageName,
		declaredExternalModules: info.declaredModules,
		downloads
	});
}

function createMinifiedSearchRecord(data: SearchRecord): MinifiedSearchRecord {
	return ({
		t: data.typePackageName,
		g: data.globals,
		m: data.declaredExternalModules,
		p: data.projectName,
		l: data.libraryName,
		d: data.downloads
	});
}

interface NpmResult {
	downloads: number;
}

export function createSearchRecords(info: TypingsData, done: (full: SearchRecord, min: MinifiedSearchRecord) => void) {
	const pkg = info.typingsPackageName;
	const url = "https://api.npmjs.org/downloads/point/last-month/" + pkg;

	const skipDownloads = process.argv.some(arg => arg === "--skipDownloads");

	if (skipDownloads) {
		setImmediate(() => {
			const record = createSearchRecord(info, -1);
			done(record, createMinifiedSearchRecord(record));
		});
	} else {
		request.get(url, (err: any, resp: any, data: string) => {
			const json: NpmResult = JSON.parse(data);
			if (err)  { throw err; }
			const record = createSearchRecord(info, json.downloads || 0);
			done(record, createMinifiedSearchRecord(record));
		});
	}
}
