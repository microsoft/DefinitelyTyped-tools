import * as common from "./lib/common";
import { nAtATime } from "./lib/util";
import * as generator from "./lib/package-generator";
import Versions from "./lib/versions";

if (!module.parent) {
	if (!Versions.existsSync()) {
		console.log("Run calculate-versions first!");
	} else {
		main().catch(console.error);
	}
}

export default async function main(): Promise<void> {
	const log: string[] = [];
	const typeData = common.readTypesDataFile();
	const typings = common.typings(typeData);
	const versions = await Versions.loadFromLocalFile();

	await nAtATime(10, typings, async typing =>
		logGeneration(typing, await generator.generatePackage(typing, typeData, versions)));

	await nAtATime(10, common.readNotNeededPackages(), async pkg =>
		logGeneration(pkg, await generator.generateNotNeededPackage(pkg)));

	common.writeLogSync("package-generator.md", log);

	async function logGeneration(pkg: common.AnyPackage, generateResult: { log: string[] }) {
		log.push(` * ${pkg.libraryName}`);
		generateResult.log.forEach(line => log.push(`   * ${line}`));
	}
}
