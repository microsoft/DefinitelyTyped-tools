import * as yargs from "yargs";

import { Options } from "./lib/common";
import { AllPackages } from "./lib/packages";
import Versions, { writeChanges } from "./lib/versions";
import { consoleLogger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	const forceUpdate = yargs.argv.forceUpdate;
	done(main(forceUpdate, Options.defaults));
}

export default async function main(forceUpdate: boolean, options: Options): Promise<void> {
	console.log("=== Calculating versions ===");

	const { changes, additions, versions } = await Versions.determineFromNpm(await AllPackages.read(options), consoleLogger.info, forceUpdate, options);
	await writeChanges(changes, additions);
	await versions.save();
}
