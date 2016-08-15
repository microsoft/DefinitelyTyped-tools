import * as yargs from "yargs";
import { existsTypesDataFileSync, readTypings } from "./lib/common";
import Versions, { Changes, writeChanges } from "./lib/versions";
import { done } from "./lib/util";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const forceUpdate = yargs.argv.forceUpdate;
		done(main(forceUpdate));
	}
}

export default async function main(forceUpdate: boolean): Promise<void> {
	console.log("\n## Calculating versions\n");
	const versions = await Versions.loadFromBlob();
	const changes: Changes = [];
	for (const typing of await readTypings()) {
		if (versions.recordUpdate(typing, forceUpdate)) {
			console.log(`Changed: ${typing.typingsPackageName}`);
			changes.push(typing.typingsPackageName);
		}
	}
	await versions.saveLocally();
	await writeChanges(changes);
}
