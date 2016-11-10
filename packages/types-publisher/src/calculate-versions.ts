import * as yargs from "yargs";

import { Options, existsTypesDataFileSync, readAllPackages } from "./lib/common";
import Versions, { writeChanges } from "./lib/versions";
import { consoleLogger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const forceUpdate = yargs.argv.forceUpdate;
		done(main(forceUpdate, Options.defaults));
	}
}

export default async function main(forceUpdate: boolean, options: Options): Promise<void> {
	console.log("=== Calculating versions ===");

	const { changes, additions, versions } = await Versions.determineFromNpm(await readAllPackages(options), consoleLogger.info, forceUpdate);
	await writeChanges(changes, additions);
	await versions.save();
}
