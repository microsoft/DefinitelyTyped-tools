import { TypingsData, existsTypesDataFileSync, readTypings, writeLog } from "./lib/common";
import { done } from "./lib/util";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		done(main());
	}
}

export default async function main(): Promise<void> {
	const infos = await readTypings();
	const libConflicts = await check(infos, info => info.libraryName, "Library Name");
	const projConflicts = await check(infos, info => info.projectName, "Project Name");

	await writeLog("conflicts.md", libConflicts.concat(projConflicts));
}

async function check(infos: TypingsData[], func: (info: TypingsData) => string, key: string) {
	const lookup: { [libName: string]: string[] } = {};
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
