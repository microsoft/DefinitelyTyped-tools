import { emptyDir } from "fs-extra";
import * as yargs from "yargs";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import generateAnyPackage from "./lib/package-generator";
import { AllPackages, outputDir } from "./lib/packages";
import Versions, { changedPackages, readVersionsAndChanges, VersionsAndChanges } from "./lib/versions";
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
	done(async () => {
		const dt = await getDefinitelyTyped(Options.defaults);
		await (singleName ? single(singleName, dt) : main(dt, await AllPackages.read(dt), await readVersionsAndChanges(), all, tgz));
	});
}

export default async function main(
	dt: FS,
	allPackages: AllPackages,
	{ versions, changes }: VersionsAndChanges,
	all = false,
	tgz = false,
): Promise<void> {
	const [log, logResult] = logger();
	log(`\n## Generating ${all ? "all" : "changed"} packages\n`);

	await emptyDir(outputDir);

	const packages = all ? allPackages.allPackages() : await changedPackages(allPackages, changes);

	await nAtATime(10, packages, async pkg => {
		const logs = await generateAnyPackage(pkg, allPackages, versions, dt);
		if (tgz) {
			await writeTgz(pkg.outputDirectory, `${pkg.outputDirectory}.tgz`);
		}
		log(` * ${pkg.libraryName}`);
		moveLogs(log, logs, line => `   * ${line}`);
	});

	await writeLog("package-generator.md", logResult());
}

async function single(singleName: string, dt: FS): Promise<void> {
	await emptyDir(outputDir);
	const allPackages = await AllPackages.read(dt);
	const pkg = allPackages.getSingle(singleName);
	const versions = await Versions.load();
	const logs = await generateAnyPackage(pkg, allPackages, versions, dt);
	console.log(logs.join("\n"));
}
