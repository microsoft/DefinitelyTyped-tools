import * as yargs from "yargs";

import { Options, writeDataFile } from "./lib/common";
import { AllPackages } from "./lib/packages";
import { createSearchRecord, SearchRecord } from "./lib/search-index-generator";
import { done, nAtATime } from "./util/util";

if (!module.parent) {
	const skipDownloads = yargs.argv.skipDownloads;
	const single = yargs.argv.single;
	if (single) {
		done(doSingle(single, skipDownloads));
	} else {
		const full = yargs.argv.full;
		done(main(skipDownloads, full, Options.defaults));
	}
}

export default async function main(skipDownloads: boolean, full: boolean, options: Options): Promise<void> {
	const packages = await AllPackages.readTypings();
	console.log(`Generating search index...`);

	const records = await nAtATime(25, packages, pkg => createSearchRecord(pkg, skipDownloads), {
		name: "Indexing...",
		flavor: pkg => pkg.desc,
		options
	});
	// Most downloads first
	records.sort((a, b) => b.d - a.d);

	console.log(`Done generating search index`);

	console.log(`Writing out data files`);
	await writeDataFile("search-index-min.json", records, false);
	if (full) {
		await writeDataFile("search-index-full.json", records.map(verboseRecord), true);
	}
}

async function doSingle(name: string, skipDownloads: boolean): Promise<void> {
	const pkg = await AllPackages.readSingle(name);
	const record = await createSearchRecord(pkg, skipDownloads);
	console.log(verboseRecord(record));
}

function verboseRecord(r: SearchRecord): {} {
	return renameProperties(r, {
		t: "typePackageName",
		g: "globals",
		m: "declaredExternalModules",
		p: "projectName",
		l: "libraryName",
		d: "downloads",
		r: "redirect"
	});
}

function renameProperties(obj: any, replacers: { [name: string]: string }): {} {
	const out: any = {};
	for (const key of Object.getOwnPropertyNames(obj)) {
		out[replacers[key]] = obj[key];
	}
	return out;
}
