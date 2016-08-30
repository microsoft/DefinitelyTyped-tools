import * as yargs from "yargs";
import { AnyPackage, existsTypesDataFileSync, readNotNeededPackages, readTypesDataFile, TypesDataFile, typingsFromData } from "./lib/common";
import { logger, moveLogs, writeLog } from "./lib/logging";
import { done, nAtATime } from "./lib/util";
import generateAnyPackage from "./lib/package-generator";
import Versions, { readChanges } from "./lib/versions";

if (!module.parent) {
	if (!Versions.existsSync()) {
		console.log("Run calculate-versions first!");
	} else if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const all = yargs.argv.all;
		const singleName = yargs.argv.single;
		if (all && singleName) {
			throw new Error("Select only one of -single=foo or --all.");
		}
		done((singleName ? single(singleName) : main(all)));
	}
}

export default async function main(all: boolean = false): Promise<void> {
	const [log, logResult] = logger();
	log(`\n## Generating ${all ? "all" : "changed"} packages\n`);
	const { typeData, allPackages, versions } = await loadPrerequisites();

	const packages = all ? allPackages : await changedPackages(allPackages);

	await nAtATime(10, packages, async pkg => {
		const logs = await generateAnyPackage(pkg, typeData, versions);
		log(` * ${pkg.libraryName}`);
		moveLogs(log, logs, line => `   * ${line}`);
	});

	await writeLog("package-generator.md", logResult());
}

async function single(singleName: string): Promise<void> {
	const { typeData, allPackages, versions } = await loadPrerequisites();

	const pkg = allPackages.find(t => t.typingsPackageName === singleName);
	if (!pkg) {
		throw new Error(`No package ${singleName} to generate.`);
	}
	const logs = await generateAnyPackage(pkg, typeData, versions);
	console.log(logs.join("\n"));
}

async function loadPrerequisites(): Promise<{ typeData: TypesDataFile, allPackages: AnyPackage[], versions: Versions }> {
	const [typeData, notNeededPackages, versions] = await Promise.all([await readTypesDataFile(), await readNotNeededPackages(), await Versions.loadFromLocalFile()]);
	const typings = typingsFromData(typeData);
	const allPackages = (<AnyPackage[]> typings).concat(notNeededPackages);
	return { typeData, allPackages, versions };
}

async function changedPackages(allPackages: AnyPackage[]): Promise<AnyPackage[]> {
	const changes = await readChanges();
	return changes.map(changedPackageName => {
		const pkg = allPackages.find(p => p.typingsPackageName === changedPackageName);
		if (pkg === undefined) {
			throw new Error(`Expected to find a package named ${changedPackageName}`);
		}
		return pkg;
	});
}
