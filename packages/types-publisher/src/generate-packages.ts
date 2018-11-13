import { emptyDir } from "fs-extra";
import * as yargs from "yargs";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { generateNotNeededPackage, generateTypingPackage } from "./lib/package-generator";
import { AllPackages, outputDir } from "./lib/packages";
import { ChangedPackages, readChangedPackages } from "./lib/versions";
import { logger, writeLog } from "./util/logging";
import { writeTgz } from "./util/tgz";
import { done } from "./util/util";

if (!module.parent) {
	const tgz = !!yargs.argv.tgz;
	done(async () => {
		const dt = await getDefinitelyTyped(Options.defaults);
		const allPackages = await AllPackages.read(dt);
		await main(dt, allPackages, await readChangedPackages(allPackages), tgz);
	});
}

export default async function main(dt: FS, allPackages: AllPackages, changedPackages: ChangedPackages, tgz = false): Promise<void> {
	const [log, logResult] = logger();
	log("\n## Generating packages\n");

	await emptyDir(outputDir);

	for (const { pkg, version } of changedPackages.changedTypings) {
		await generateTypingPackage(pkg, allPackages, version, dt);
		if (tgz) {
			await writeTgz(pkg.outputDirectory, `${pkg.outputDirectory}.tgz`);
		}
		log(` * ${pkg.libraryName}`);
	}
	for (const pkg of changedPackages.changedNotNeededPackages) {
		await generateNotNeededPackage(pkg);
	}

	await writeLog("package-generator.md", logResult());
}
