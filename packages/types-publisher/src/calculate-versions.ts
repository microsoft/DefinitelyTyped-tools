import * as yargs from "yargs";

import { Options } from "./lib/common";
import { AllPackages } from "./lib/packages";
import Versions, { writeChanges } from "./lib/versions";
import { Fetcher } from "./util/io";
import { consoleLogger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const forceUpdate = yargs.argv.forceUpdate;
	done(main(forceUpdate, new Fetcher(), Options.defaults));
}

export default async function main(forceUpdate: boolean, fetcher: Fetcher, options: Options): Promise<void> {
	console.log("=== Calculating versions ===");

	const { changes, versions } = await Versions.determineFromNpm(await AllPackages.read(options), consoleLogger.info, forceUpdate, fetcher, options);
	await writeChanges(changes);
	await versions.save();
}
