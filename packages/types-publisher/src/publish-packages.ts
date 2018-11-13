import * as yargs from "yargs";

import { getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { NpmPublishClient } from "./lib/npm-client";
import { deprecateNotNeededPackage, publishNotNeededPackage, publishTypingsPackage } from "./lib/package-publisher";
import { AllPackages } from "./lib/packages";
import { ChangedPackages, readChangedPackages } from "./lib/versions";
import { logger, writeLog } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	const deprecateName = yargs.argv.deprecate;

	if (deprecateName !== undefined) {
		throw new Error("Select only one of --single=foo or --deprecate=foo or --shouldUnpublish");
	}

	done(async () => {
		const dt = await getDefinitelyTyped(Options.defaults);
		if (deprecateName !== undefined) {
			// A '--deprecate' command is available in case types-publisher got stuck *while* trying to deprecate a package.
			// Normally this should not be needed.
			await deprecateNotNeededPackage(await NpmPublishClient.create(), await AllPackages.readSingleNotNeeded(deprecateName, dt));
		} else {
			await main(await readChangedPackages(await AllPackages.read(dt)), dry);
		}
	});
}

export default async function main(changedPackages: ChangedPackages, dry: boolean): Promise<void> {
	const [log, logResult] = logger();
	if (dry) {
		log("=== DRY RUN ===");
	}

	const client = await NpmPublishClient.create();

	for (const cp of changedPackages.changedTypings) {
		console.log(`Publishing ${cp.pkg.desc}...`);
		await publishTypingsPackage(client, cp, dry, log);
	}
	for (const n of changedPackages.changedNotNeededPackages) {
		await publishNotNeededPackage(client, n, dry, log);
	}

	await writeLog("publishing.md", logResult());
	console.log("Done!");
}
