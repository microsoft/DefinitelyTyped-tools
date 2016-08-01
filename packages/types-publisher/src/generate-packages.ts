import { AnyPackage, existsTypesDataFileSync, readNotNeededPackages, readTypesDataFile, typingsFromData, writeLog } from "./lib/common";
import { done, nAtATime } from "./lib/util";
import * as generator from "./lib/package-generator";
import Versions from "./lib/versions";

if (!module.parent) {
	if (!Versions.existsSync()) {
		console.log("Run calculate-versions first!");
	} else if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		done(main());
	}
}

export default async function main(): Promise<void> {
	const log: string[] = [];
	const typeData = await readTypesDataFile();
	const typings = typingsFromData(typeData);
	const versions = await Versions.loadFromLocalFile();

	await nAtATime(10, typings, async typing =>
		logGeneration(typing, await generator.generatePackage(typing, typeData, versions)));

	await nAtATime(10, await readNotNeededPackages(), async pkg =>
		logGeneration(pkg, await generator.generateNotNeededPackage(pkg)));

	await writeLog("package-generator.md", log);

	async function logGeneration(pkg: AnyPackage, generateResult: { log: string[] }) {
		log.push(` * ${pkg.libraryName}`);
		generateResult.log.forEach(line => log.push(`   * ${line}`));
	}
}
