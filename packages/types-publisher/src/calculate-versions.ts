import * as yargs from "yargs";

import { Options } from "./lib/common";
import { CachedNpmInfoClient, UncachedNpmInfoClient } from "./lib/npm-client";
import { AllPackages } from "./lib/packages";
import Versions, { writeChanges } from "./lib/versions";
import { consoleLogger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const forceUpdate = yargs.argv.forceUpdate;
	done(main(forceUpdate, Options.defaults, new UncachedNpmInfoClient()));
}

export default async function main(forceUpdate: boolean, options: Options, uncachedClient: UncachedNpmInfoClient): Promise<void> {
	console.log("=== Calculating versions ===");
	await CachedNpmInfoClient.with(uncachedClient, async client => {
		const { changes, versions } = await Versions.determineFromNpm(await AllPackages.read(options), consoleLogger.info, forceUpdate, client);
		await writeChanges(changes);
		await versions.save();
	});
}
