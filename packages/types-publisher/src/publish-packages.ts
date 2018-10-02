import * as yargs from "yargs";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { NpmPublishClient } from "./lib/npm-client";
import publishPackage, { deprecateNotNeededPackage } from "./lib/package-publisher";
import { AllPackages } from "./lib/packages";
import Versions, { changedPackages, readVersionsAndChanges, VersionsAndChanges } from "./lib/versions";
import { logger, LogWithErrors, writeLog } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	const singleName = yargs.argv.single;
	const deprecateName = yargs.argv.deprecate;

	if (singleName !== undefined && deprecateName !== undefined) {
		throw new Error("Select only one of --single=foo or --deprecate=foo or --shouldUnpublish");
	}

	done(async () => {
		const dt = await getDefinitelyTyped(Options.defaults);
		if (deprecateName !== undefined) {
			// A '--deprecate' command is available in case types-publisher got stuck *while* trying to deprecate a package.
			// Normally this should not be needed.
			await deprecateNotNeededPackage(await NpmPublishClient.create(), await AllPackages.readSingleNotNeeded(deprecateName, dt));
		} else if (singleName !== undefined) {
			await single(singleName, dt, dry);
		} else {
			await main(await AllPackages.read(dt), await readVersionsAndChanges(), dry);
		}
	});
}

export default async function main(allPackages: AllPackages, { versions, changes }: VersionsAndChanges, dry: boolean): Promise<void> {
	const [log, logResult] = logger();
	if (dry) {
		log("=== DRY RUN ===");
	}

	const packagesShouldPublish = await changedPackages(allPackages, changes);

	const client = await NpmPublishClient.create();

	for (const pkg of packagesShouldPublish) {
		console.log(`Publishing ${pkg.desc}...`);
		const publishLog = await publishPackage(client, pkg, packagesShouldPublish, versions, allPackages.getLatest(pkg), dry);
		writeLogs({ infos: publishLog, errors: [] });
	}

	function writeLogs(res: LogWithErrors): void {
		for (const line of res.infos) {
			log(`   * ${line}`);
		}
		for (const err of res.errors) {
			log(`   * ERROR: ${err}`);
		}
	}

	await writeLog("publishing.md", logResult());
	console.log("Done!");
}

async function single(name: string, dt: FS, dry: boolean): Promise<void> {
	const allPackages = await AllPackages.read(dt);
	const versions = await Versions.load();
	const pkg = await AllPackages.readSingle(name);
	const publishLog = await publishPackage(await NpmPublishClient.create(), pkg, [], versions, allPackages.getLatest(pkg), dry);
	console.log(publishLog);
}
