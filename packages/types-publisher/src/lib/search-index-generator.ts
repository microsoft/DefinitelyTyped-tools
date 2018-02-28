import { Fetcher } from "../util/io";

import { AnyPackage } from "./packages";
import { npmApi } from "./settings";

export interface SearchRecord {
	// types package name
	t: string;
	// globals
	g: ReadonlyArray<string>;
	// modules
	m: ReadonlyArray<string>;
	// project name
	p: string;
	// library name
	l: string;
	// downloads in the last month from NPM
	d: number;
	// redirect: In the case of a not-needed package, we link to their repository instead of the dummy @types package on npm.
	r: string | undefined;
}

export async function createSearchRecord(pkg: AnyPackage, skipDownloads: boolean, fetcher: Fetcher): Promise<SearchRecord> {
	return {
		p: pkg.projectName,
		l: pkg.libraryName,
		g: pkg.globals,
		t: pkg.name,
		m: pkg.declaredModules,
		d: await getDownloads(),
		r: pkg.isNotNeeded() ? pkg.sourceRepoURL : undefined
	};

	// See https://github.com/npm/download-counts
	async function getDownloads(): Promise<number> {
		if (skipDownloads) {
			return -1;
		} else {
			const json = await fetcher.fetchJson({
				hostname: npmApi,
				path: `/downloads/point/last-month/${pkg.name}`,
				retries: true,
			}) as { downloads: number };
			// Json may contain "error" instead of "downloads", because some packages aren't available on NPM.
			return json.downloads || 0;
		}
	}
}
