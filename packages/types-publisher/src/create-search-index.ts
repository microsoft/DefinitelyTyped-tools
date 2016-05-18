import { TypingsData, TypesDataFile, typesDataFilename, readDataFile, writeDataFile } from './lib/common';
import * as fs from 'fs';
import * as request from 'request';
import * as generator from './lib/search-index-generator';

const typeData = <TypesDataFile>readDataFile(typesDataFilename);

if (typeData === undefined) {
	console.log('Run parse-definitions first!');
} else {
	main();
}

function main() {
	const packages = Object.keys(typeData);
	const totalCount = packages.length;
	console.log(`Loaded ${totalCount} entries`);

	const fullRecords: generator.SearchRecord[] = [];
	const minRecords: generator.MinifiedSearchRecord[] = [];

	next();

	function next() {
		if (packages.length === 0) {
			console.log(`Done generating search index`);
			fullRecords.sort((a, b) => a.downloads - b.downloads);
			minRecords.sort((a, b) => b.d - a.d);

			console.log(`Writing out data files`);
			writeDataFile('search-index-full.json', fullRecords);
			writeDataFile('search-index-min.json', minRecords, false);
			writeDataFile('search-index-head.json', minRecords.slice(0, 100), false);

			return;
		}
		
		if (packages.length % 100 === 0) {
			console.log(`${totalCount - packages.length} / ${totalCount}...`);
		}

		const packageName = packages.shift();
		const info = typeData[packageName];

		generator.createSearchRecords(info, (full, min) => {
			fullRecords.push(full);
			minRecords.push(min);
			next();
		});
	}
}
