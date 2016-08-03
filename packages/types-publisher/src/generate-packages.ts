import * as yargs from "yargs";
import { AnyPackage, existsTypesDataFileSync, readNotNeededPackages, readTypesDataFile, TypesDataFile, TypingsData, typingsFromData, writeLog } from "./lib/common";
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
	const log: string[] = [];
	const { typeData, typings, versions } = await loadPrerequisites();

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

async function single(singleName: string): Promise<void> {
	const { typeData, typings, versions } = await loadPrerequisites();

	const typing = typings.find(t => t.typingsPackageName === singleName);
	if (!typing) {
		throw new Error(`No package ${singleName} to generate.`);
	}

	const generateResult = await generator.generatePackage(typing, typeData, versions);
	console.log(generateResult.log.join("\n"));
}

async function loadPrerequisites(): Promise<{ typeData: TypesDataFile, typings: TypingsData[], versions: Versions }> {
	const [typeData, versions] = await Promise.all([await readTypesDataFile(), await Versions.loadFromLocalFile()]);
	const typings = typingsFromData(typeData);
	return { typeData, typings, versions };
}
