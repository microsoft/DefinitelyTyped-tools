import * as yargs from "yargs";
import * as common from "./lib/common";
import Versions, { Changes, writeChanges } from "./lib/versions";

if (!module.parent) {
	if (!common.existsTypesDataFile()) {
		console.log("Run parse-definitions first!");
	} else {
		const forceUpdate = yargs.argv.forceUpdate;
		main(forceUpdate).catch(console.error);
	}
}

export default async function main(forceUpdate: boolean): Promise<void> {
	const versions = await Versions.loadFromBlob();
	const changes: Changes = [];
	for (const typing of common.readTypings()) {
		if (versions.recordUpdate(typing, forceUpdate)) {
			changes.push(typing.typingsPackageName);
		}
	}
	await versions.saveLocally();
	await writeChanges(changes);
}
