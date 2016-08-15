import { TypingsData, existsTypesDataFileSync, readTypings } from "./lib/common";
import { Logger, logger, writeLog } from "./lib/logging";
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
	const [log, logResult] = logger();
	check(infos, info => info.libraryName, "Library Name", log);
	check(infos, info => info.projectName, "Project Name", log);
	await writeLog("conflicts.md", logResult());
}

function check(infos: TypingsData[], func: (info: TypingsData) => string, key: string, log: Logger): void {
	const lookup: { [libName: string]: string[] } = {};
	infos.forEach(info => {
		const name = func(info);
		if (name !== undefined) {
			(lookup[name] || (lookup[name] = [])).push(info.typingsPackageName);
		}
	});
	for (const k of Object.keys(lookup)) {
		if (lookup[k].length > 1) {
			log(` * Duplicate ${key} descriptions "${k}"`);
			lookup[k].forEach(n => log(`   * ${n}`));
		}
	}
}
