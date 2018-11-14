import assert = require("assert");
import oboe = require("oboe");

import { packageHasTypes } from "./check-parse-results";
import { Options, writeDataFile } from "./lib/common";
import { UncachedNpmInfoClient } from "./lib/npm-client";
import { npmRegistry } from "./lib/settings";
import ProgressBar, { strProgress } from "./util/progress";
import { filterNAtATimeOrdered, logUncaughtErrors } from "./util/util";

if (!module.parent) {
	logUncaughtErrors(main(Options.defaults));
}

/** Prints out every package on NPM with 'types'. */
async function main(options: Options): Promise<void> {
	const all = await allNpmPackages();
	await writeDataFile("all-npm-packages.json", all);
	const client = new UncachedNpmInfoClient();
	const allTyped = await filterNAtATimeOrdered(10, all, pkg => packageHasTypes(pkg, client), {
		name: "Checking for types...",
		flavor: (name, isTyped) => isTyped ? name : undefined,
		options,
	});
	await writeDataFile("all-typed-packages.json", allTyped);
	console.log(allTyped.join("\n"));
	console.log(`Found ${allTyped.length} typed packages.`);
}

function allNpmPackages(): Promise<string[]> {
	const progress = new ProgressBar({ name: "Loading NPM packages..." });

	// https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
	const url = `${npmRegistry}-/all`;
	const all: string[] = [];
	return new Promise<string[]>((resolve, reject) => {
		oboe(url)
		.node("!.*", (x, path) => {
			assert((path as string).length > 0);
			if (typeof x !== "number") {
				const { name } = x as { name: string };
				assert(typeof name === "string" && name.length > 0); // tslint:disable-line strict-type-predicates
				progress.update(strProgress(name), name);
				all.push(name);
			}
			return oboe.drop;
		})
		.done(() => {
			progress.done();
			resolve(all);
		})
		.fail(err => { reject(err.thrown); });
	});
}
