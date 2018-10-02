import * as yargs from "yargs";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { CachedNpmInfoClient, UncachedNpmInfoClient } from "./lib/npm-client";
import { AllPackages } from "./lib/packages";
import Versions, { VersionsAndChanges, writeChanges } from "./lib/versions";
import { consoleLogger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const forceUpdate = yargs.argv.forceUpdate;
	done(async () => main(forceUpdate, await getDefinitelyTyped(Options.defaults), new UncachedNpmInfoClient()));
}

export default async function main(forceUpdate: boolean, dt: FS, uncachedClient: UncachedNpmInfoClient): Promise<VersionsAndChanges> {
	console.log("=== Calculating versions ===");
	return CachedNpmInfoClient.with(uncachedClient, async client => {
		const ver = await Versions.determineFromNpm(await AllPackages.read(dt), consoleLogger.info, forceUpdate, client);
		await writeChanges(ver.changes);
		await ver.versions.save();
		return ver;
	});
}
