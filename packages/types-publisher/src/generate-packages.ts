import * as yargs from "yargs";

import { AnyPackage, existsTypesDataFileSync, getOutputPath, getPackage, readNotNeededPackages, readTypesDataFile,
	TypesDataFile, typingsFromData } from "./lib/common";
import generateAnyPackage from "./lib/package-generator";
import { logger, moveLogs, writeLog } from "./util/logging";
import { writeTgz } from "./util/tgz";
import { done, nAtATime } from "./util/util";
import Versions, { changedPackages } from "./lib/versions";

if (!module.parent) {
	if (!Versions.existsSync()) {
		console.log("Run calculate-versions first!");
	} else if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const all = yargs.argv.all;
		const singleName = yargs.argv.single;
		const tgz = !!yargs.argv.tgz;
		if (all && singleName) {
			throw new Error("Select only one of -single=foo or --all.");
		}
		done((singleName ? single(singleName) : main(all, tgz)));
	}
}

export default async function main(all = false, tgz = false): Promise<void> {
	const [log, logResult] = logger();
	log(`\n## Generating ${all ? "all" : "changed"} packages\n`);
	const { typeData, allPackages, versions } = await loadPrerequisites();

	const packages = all ? allPackages : await changedPackages(allPackages);

	await nAtATime(10, packages, async pkg => {
		const logs = await generateAnyPackage(pkg, typeData, versions);
		if (tgz) {
			await writeTgz(getOutputPath(pkg), getOutputPath(pkg) + ".tgz");
		}
		log(` * ${pkg.libraryName}`);
		moveLogs(log, logs, line => `   * ${line}`);
	});

	await writeLog("package-generator.md", logResult());
}

async function single(singleName: string): Promise<void> {
	const { typeData, versions } = await loadPrerequisites();
	const pkg = getPackage(typeData, singleName);
	const logs = await generateAnyPackage(pkg, typeData, versions);
	console.log(logs.join("\n"));
}

async function loadPrerequisites(): Promise<{ typeData: TypesDataFile, allPackages: AnyPackage[], versions: Versions }> {
	const typeData = await readTypesDataFile();
	const notNeededPackages = await readNotNeededPackages();
	const versions = await Versions.load();
	const typings = typingsFromData(typeData);
	const allPackages = [ ...typings, ...notNeededPackages ];
	return { typeData, allPackages, versions };
}
