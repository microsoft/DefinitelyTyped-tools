import * as yargs from "yargs";
import { AnyPackage, existsTypesDataFileSync, NotNeededPackage, readNotNeededPackages, readTypesDataFile, TypesDataFile, TypingsData, typingsFromData } from "./lib/common";
import { Log, logger, moveLogs, writeLog } from "./lib/logging";
import { done, nAtATime } from "./lib/util";
import * as generator from "./lib/package-generator";
import Versions from "./lib/versions";

if (!module.parent) {
	if (!Versions.existsSync()) {
		console.log("Run calculate-versions first!");
	} else if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const singleName = yargs.argv.single;
		done((singleName ? single(singleName) : main()));
	}
}

export default async function main(): Promise<void> {
	const [log, logResult] = logger();
	log("\n## Generating packages\n");
	const { typeData, typings, notNeededPackages, versions } = await loadPrerequisites();

	await nAtATime(10, typings, async typing =>
		logGeneration(typing, await generator.generatePackage(typing, typeData, versions)));

	await nAtATime(10, notNeededPackages, async pkg =>
		logGeneration(pkg, await generator.generateNotNeededPackage(pkg)));

	await writeLog("package-generator.md", logResult());

	async function logGeneration(pkg: AnyPackage, logs: Log) {
		log(` * ${pkg.libraryName}`);
		moveLogs(log, logs, line => `   * ${line}`);
	}
}

async function single(singleName: string): Promise<void> {
	const { typeData, typings, notNeededPackages, versions } = await loadPrerequisites();

	let generateResult: string[];
	const typing = typings.find(t => t.typingsPackageName === singleName);
	if (typing) {
		generateResult = await generator.generatePackage(typing, typeData, versions);
	}
	else {
		const notNeededPackage = notNeededPackages.find(t => t.typingsPackageName === singleName);
		if (!notNeededPackage) {
			throw new Error(`No package ${singleName} to generate.`);
		}
		generateResult = await generator.generateNotNeededPackage(notNeededPackage);
	}

	console.log(generateResult.join("\n"));
}

async function loadPrerequisites(): Promise<{ typeData: TypesDataFile, typings: TypingsData[], notNeededPackages: NotNeededPackage[], versions: Versions }> {
	const [typeData, notNeededPackages, versions] = await Promise.all([await readTypesDataFile(), await readNotNeededPackages(), await Versions.loadFromLocalFile()]);
	const typings = typingsFromData(typeData);
	return { typeData, typings, notNeededPackages, versions };
}
