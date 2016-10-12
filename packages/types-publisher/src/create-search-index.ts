import * as yargs from "yargs";
import { existsTypesDataFileSync, readAllPackagesArray, readPackage, writeDataFile } from "./lib/common";
import { done, nAtATime } from "./lib/util";
import { createSearchRecord, SearchRecord } from "./lib/search-index-generator";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const skipDownloads = yargs.argv.skipDownloads;
		const single = yargs.argv.single;
		if (single) {
			done(doSingle(single, skipDownloads));
		} else {
			const full = yargs.argv.full;
			done(main(skipDownloads, full));
		}
	}
}

export default async function main(skipDownloads: boolean, full: boolean): Promise<void> {
	const packages = await readAllPackagesArray();
	console.log(`Loaded ${packages.length} entries`);

	const records = await nAtATime(25, packages, pkg => createSearchRecord(pkg, skipDownloads));
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
	const pkg = await readPackage(name);
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

function renameProperties(obj: {}, replacers: { [name: string]: string }): {} {
	const out: any = {};
	for (const key of Object.getOwnPropertyNames(obj)) {
		out[replacers[key]] = (<any> obj)[key];
	}
	return out;
}
