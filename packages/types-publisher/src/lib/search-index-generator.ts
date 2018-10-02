import { UncachedNpmInfoClient } from "./npm-client";
import { AnyPackage } from "./packages";

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

export async function createSearchRecord(pkg: AnyPackage, client: UncachedNpmInfoClient): Promise<SearchRecord> {
	return {
		p: pkg.projectName,
		l: pkg.libraryName,
		g: pkg.globals,
		t: pkg.name,
		m: pkg.declaredModules,
		d: await client.getDownloads(pkg.name),
		r: pkg.isNotNeeded() ? pkg.sourceRepoURL : undefined
	};
}
