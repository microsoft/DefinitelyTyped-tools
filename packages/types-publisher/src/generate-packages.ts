import * as yargs from "yargs";

import { Options } from "./lib/common";
import { AllPackages } from "./lib/packages";
import generateAnyPackage from "./lib/package-generator";
import Versions, { changedPackages } from "./lib/versions";
import { logger, moveLogs, writeLog } from "./util/logging";
import { writeTgz } from "./util/tgz";
import { done, nAtATime } from "./util/util";

if (!module.parent) {
	const all = yargs.argv.all;
	const singleName = yargs.argv.single;
	const tgz = !!yargs.argv.tgz;
	if (all && singleName) {
		throw new Error("Select only one of -single=foo or --all.");
	}
	done((singleName ? single(singleName, Options.defaults) : main(Options.defaults, all, tgz)));
}

export default async function main(options: Options, all = false, tgz = false): Promise<void> {
	const [log, logResult] = logger();
	log(`\n## Generating ${all ? "all" : "changed"} packages\n`);
	const allPackages = await AllPackages.read(options);
	const versions = await Versions.load();

	const packages = all ? allPackages.allPackages() : await changedPackages(allPackages);

	await nAtATime(10, packages, async pkg => {
		const logs = await generateAnyPackage(pkg, allPackages, versions, options);
		if (tgz) {
			await writeTgz(pkg.outputDirectory, pkg.outputDirectory + ".tgz");
		}
		log(` * ${pkg.libraryName}`);
		moveLogs(log, logs, line => `   * ${line}`);
	});

	await writeLog("package-generator.md", logResult());
}

async function single(singleName: string, options: Options): Promise<void> {
	const allPackages = await AllPackages.read(options);
	const pkg = allPackages.getSingle(singleName);
	const versions = await Versions.load();
	const logs = await generateAnyPackage(pkg, allPackages, versions, options);
	console.log(logs.join("\n"));
}
