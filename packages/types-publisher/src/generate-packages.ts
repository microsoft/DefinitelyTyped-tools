import * as yargs from "yargs";
import * as common from "./lib/common";
import { nAtATime } from "./lib/util";
import * as generator from "./lib/package-generator";

const typeData = common.readTypesDataFile();

if (typeData === undefined) {
	console.log("Run parse-definitions first!");
} else {
	main().catch(console.error);
}

async function main(): Promise<void> {
	const forceUpdate = yargs.argv.forceUpdate;

	const log: string[] = [];
	await nAtATime(10, common.typings(typeData), async typing =>
		logGeneration(typing, await generator.generatePackage(typing, typeData, forceUpdate)));
	await nAtATime(10, common.readNotNeededPackages(), async pkg =>
		logGeneration(pkg, await generator.generateNotNeededPackage(pkg)));

	common.writeLogSync("package-generator.md", log);

	async function logGeneration(pkg: common.AnyPackage, generateResult: { log: string[] }) {
		log.push(` * ${pkg.libraryName}`);
		generateResult.log.forEach(line => log.push(`   * ${line}`));
	}
}
