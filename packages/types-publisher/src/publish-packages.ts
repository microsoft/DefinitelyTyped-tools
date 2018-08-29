import * as yargs from "yargs";

import { Options } from "./lib/common";
import { NpmPublishClient } from "./lib/npm-client";
import publishPackage, { deprecateNotNeededPackage } from "./lib/package-publisher";
import { AllPackages } from "./lib/packages";
import Versions, { changedPackages } from "./lib/versions";
import { logger, LogWithErrors, writeLog } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	const singleName = yargs.argv.single;
	const deprecateName = yargs.argv.deprecate;

	if (singleName !== undefined && deprecateName !== undefined) {
		throw new Error("Select only one of --single=foo or --deprecate=foo or --shouldUnpublish");
	}

	done(go());

	async function go(): Promise<void> {
		if (deprecateName !== undefined) {
			// A '--deprecate' command is available in case types-publisher got stuck *while* trying to deprecate a package.
			// Normally this should not be needed.
			await deprecateNotNeededPackage(await NpmPublishClient.create(), await AllPackages.readSingleNotNeeded(deprecateName, Options.defaults));
		} else if (singleName !== undefined) {
			await single(singleName, Options.defaults, dry);
		} else {
			await main(dry, Options.defaults);
		}
	}
}

export default async function main(dry: boolean, options: Options): Promise<void> {
	const [log, logResult] = logger();
	if (dry) {
		log("=== DRY RUN ===");
	}

	const allPackages = await AllPackages.read(options);
	const versions = await Versions.load();
	const packagesShouldPublish = await changedPackages(allPackages);

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

async function single(name: string, options: Options, dry: boolean): Promise<void> {
	const allPackages = await AllPackages.read(options);
	const versions = await Versions.load();
	const pkg = await AllPackages.readSingle(name);
	const publishLog = await publishPackage(await NpmPublishClient.create(), pkg, [], versions, allPackages.getLatest(pkg), dry);
	console.log(publishLog);
}
