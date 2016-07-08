import { TypingsData, existsTypesDataFile, readTypings, writeLogSync } from "./lib/common";

if (!module.parent) {
	if (!existsTypesDataFile()) {
		console.log("Run parse-definitions first!");
	} else {
		main();
	}
}

export default function main() {
	const libConflicts = check(info => info.libraryName, "Library Name");
	const projConflicts = check(info => info.projectName, "Project Name");

	writeLogSync("conflicts.md", libConflicts.concat(projConflicts));
}

function check(func: (info: TypingsData) => string, key: string) {
	const lookup: { [libName: string]: string[] } = {};
	const infos = readTypings();
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
