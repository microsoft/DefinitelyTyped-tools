import { TypingsData, TypesDataFile, typesDataFilename, readDataFile, writeDataFile, writeLogSync } from './lib/common';

const typeData = <TypesDataFile>readDataFile(typesDataFilename);

if (typeData === undefined) {
	console.log('Run parse-definitions first!');
} else {
	main();
}

function main() {
	const libConflicts = check(info => info.libraryName, 'Library Name');
	const projConflicts = check(info => info.projectName, 'Project Name');

	writeLogSync('conflicts.md', libConflicts.concat(projConflicts));
}

function check(func: (info: TypingsData) => string, key: string) {
	const lookup: { [libName: string]: string[] } = {};
	const infos = Object.keys(typeData).map(k => typeData[k]);
	const result: string[] = [];
	infos.forEach(info => {
		const name = func(info);
		if (name !== undefined) {
			(lookup[name] || (lookup[name] = [])).push(info.typingsPackageName);
		}
	});
	for (const k of Object.keys(lookup)) {
		if (lookup[k].length > 1) {
			result.push(` * Duplicate ${key} descriptions "${k}"`);
			lookup[k].forEach(n => result.push(`   * ${n}`));
		}
	}
	return result;
}
