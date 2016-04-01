// https://api.npmjs.org/downloads/point/last-month/jquery,express,flarp,react

import * as fs from 'fs';
import * as request from 'request';

const rawData: SearchRecord[] = JSON.parse(fs.readFileSync('search-raw.json', 'utf-8'));

searchData.push({
	packageName: info.data.projectName,
	libraryName: info.data.libraryName,
	globals: info.data.globals,
	npmPackageName: info.data.typingsPackageName,
	typePackageName: info.data.typingsPackageName,
	declaredExternalModules: info.data.declaredModules
});

interface NpmResult {
	[packageName: string]: {
		downloads: number;
	}
}

function getDownloadCounts(done: () => void) {
	function next() {
		const unchecked = rawData.filter(r => (r.npmPackageName !== undefined) && (r.downloads === undefined));
		if (unchecked.length === 0) {
			done();
		} else {
			// Unknown: How many can we query at once?
			const nextToCheck = unchecked.slice(0, 200);
			const url = 'https://api.npmjs.org/downloads/point/last-month/' + nextToCheck.map(r => r.npmPackageName).join(',');
			request.get(url, (err: any, resp: any, data: string) => {
				const json = JSON.parse(data);
				if (err) throw err;
				nextToCheck.forEach(r => {
					const result = json[r.npmPackageName];
					r.downloads = result ? result.downloads : 0;
				});
				next();
			});
		}
	}

	next();
}


function main() {
	getDownloadCounts(() => {
		rawData.sort((a, b) => a.downloads - b.downloads);
		fs.writeFileSync('search-with-downloads.json', JSON.stringify(rawData, undefined, 4), 'utf-8');
	});
}

main();
