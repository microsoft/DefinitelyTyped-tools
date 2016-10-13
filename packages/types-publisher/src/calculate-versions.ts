import * as yargs from "yargs";

import { existsTypesDataFileSync, readAllPackages } from "./lib/common";
import Versions, { writeChanges } from "./lib/versions";
import { consoleLogger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const forceUpdate = yargs.argv.forceUpdate;
		done(main(forceUpdate));
	}
}

export default async function main(forceUpdate: boolean): Promise<void> {
	const { changes, versions } = await Versions.determineFromNpm(await readAllPackages(), consoleLogger.info, forceUpdate);
	await writeChanges(changes);
	await versions.save();
}
