import * as yargs from "yargs";
import { existsTypesDataFileSync, readAllPackages, writeDataFile } from "./lib/common";
import { done, nAtATime } from "./lib/util";
import { createSearchRecord, minifySearchRecord } from "./lib/search-index-generator";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const skipDownloads = yargs.argv.skipDownloads;
		done(main(skipDownloads));
	}
}

export default async function main(skipDownloads: boolean): Promise<void> {
	let packages = await readAllPackages();
	console.log(`Loaded ${packages.length} entries`);

	const records = await nAtATime(100, packages, pkg => createSearchRecord(pkg, skipDownloads));
	// Most downloads first
	records.sort((a, b) => b.downloads - a.downloads);

	console.log(`Done generating search index`);
	const minRecords = records.map(minifySearchRecord);

	console.log(`Writing out data files`);
	await Promise.all([
		writeDataFile("search-index-full.json", records),
		writeDataFile("search-index-min.json", minRecords, false),
		writeDataFile("search-index-head.json", minRecords.slice(0, 100), false)
	]);
}
