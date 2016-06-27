import { AnyPackage, readTypesDataFile, readNotNeededPackages, typings, writeDataFile } from "./lib/common";
import { nAtATime } from "./lib/util";
import { createSearchRecord, minifySearchRecord } from "./lib/search-index-generator";

const typeData = readTypesDataFile();

if (typeData === undefined) {
	console.log("Run parse-definitions first!");
} else {
	main().catch(console.error);
}

async function main(): Promise<void> {
	let packages = (typings(typeData) as AnyPackage[]).concat(readNotNeededPackages());
	console.log(`Loaded ${packages.length} entries`);

	const records = await nAtATime(100, packages, createSearchRecord);
	// Most downloads first
	records.sort((a, b) => b.downloads - a.downloads);

	console.log(`Done generating search index`);
	const minRecords = records.map(minifySearchRecord);

	console.log(`Writing out data files`);
	writeDataFile("search-index-full.json", records);
	writeDataFile("search-index-min.json", minRecords, false);
	writeDataFile("search-index-head.json", minRecords.slice(0, 100), false);
}
