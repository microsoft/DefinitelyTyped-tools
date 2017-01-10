import assert = require("assert");
import oboe = require("oboe");

import { packageHasTypes } from "./check-parse-results";
import { Options, writeDataFile } from "./lib/common";
import { npmRegistry } from "./lib/settings";
import ProgressBar, { strProgress } from "./util/progress";
import { done, filterNAtATime } from "./util/util";

if (!module.parent) {
	done(main(Options.defaults));
}

/** Prints out every package on NPM with 'types'. */
async function main(options: Options) {
	const all = await allNpmPackages();
	await writeDataFile("all-npm-packages.json", all);
	const allTyped = await filterNAtATime(10, all, packageHasTypes, {
		name: "Checking for types...",
		flavor: (name, isTyped) => isTyped ? name : undefined,
		options
	});
	await writeDataFile("all-typed-packages.json", allTyped);
	console.log(allTyped.join("\n"));
	console.log(`Found ${allTyped.length} typed packages.`);
}

function allNpmPackages(): Promise<string[]> {
	const progress = new ProgressBar({ name: "Loading NPM packages..." });

	// https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
	const url = npmRegistry + "-/all";
	const all: string[] = [];
	return new Promise((resolve, reject) => {
		oboe(url)
		.node("!.*", (x, path) => {
			assert(path.length > 0);
			if (typeof x !== "number") {
				const { name } = x;
				assert(typeof name === "string" && name.length > 0);
				progress.update(strProgress(name), name);
				all.push(name);
			}
			return oboe.drop;
		})
		.done(() => {
			progress.done();
			resolve(all);
		})
		.fail(err => reject(err.thrown));
	});
}
