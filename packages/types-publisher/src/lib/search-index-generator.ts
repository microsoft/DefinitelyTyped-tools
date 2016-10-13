import { fetchJson } from "../util/io";

import { AnyPackage } from "./common";

export interface SearchRecord {
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
	// redirect: In the case of a not-needed package, we link to their repository instead of the dummy @types package on npm.
	r: string | undefined;
}

export async function createSearchRecord(info: AnyPackage, skipDownloads: boolean): Promise<SearchRecord> {
	return {
		p: info.projectName,
		l: info.libraryName,
		g: info.globals,
		t: info.typingsPackageName,
		m: info.declaredModules,
		d: await getDownloads(),
		r: info.packageKind === "not-needed" ? info.sourceRepoURL : undefined
	};

	// See https://github.com/npm/download-counts
	async function getDownloads(): Promise<number> {
		if (skipDownloads) {
			return -1;
		} else {
			const url = `https://api.npmjs.org/downloads/point/last-month/${info.typingsPackageName}`;
			interface NpmResult { downloads: number; }
			const json = <NpmResult> (await fetchJson(url));
			// Json may contain "error" instead of "downloads", because some packages aren't available on NPM.
			return json.downloads || 0;
		}
	}
}
