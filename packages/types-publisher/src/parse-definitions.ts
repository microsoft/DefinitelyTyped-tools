import * as yargs from "yargs";

import * as parser from "./lib/definition-parser";
import { Options, isTypingDirectory, writeDataFile } from "./lib/common";
import { TypingsVersionsRaw, packageRootPath, typesDataFilename } from "./lib/packages";
import { logger, quietLogger, moveLogs, writeLog } from "./util/logging";
import { done, filterAsyncOrdered, nAtATime } from "./util/util";

import fsp = require("fs-promise");

if (!module.parent) {
	const singleName = yargs.argv.single;
	done((singleName ? single(singleName, Options.defaults) : main(Options.defaults)));
}

async function filterPaths(paths: string[], options: Options): Promise<string[]> {
	const fullPaths = paths
		// Remove hidden paths and known non-package directories
		.filter(s => s[0] !== "." && s[0] !== "_" && isTypingDirectory(s))
		// Sort by name
		.sort();
	// Remove non-folders
	return filterAsyncOrdered(fullPaths, async s => (await fsp.stat(packageRootPath(s, options))).isDirectory());
}

export default async function main(options: Options): Promise<void> {
	const [summaryLog, summaryLogResult] = logger();
	const [detailedLog, detailedLogResult] = quietLogger();

	summaryLog("# Typing Publish Report Summary");
	summaryLog(`Started at ${(new Date()).toUTCString()}`);

	const packageNames = await filterPaths(await fsp.readdir(options.definitelyTypedPath), options);

	summaryLog(`Found ${packageNames.length} typings folders in ${options.definitelyTypedPath}`);

	const typings: { [name: string]: TypingsVersionsRaw } = {};

	await nAtATime(1, packageNames, use, { name: "Parsing...", flavor: name => name, options });
	async function use(packageName: string): Promise<void> {
		const { data, logs } = await parser.getTypingInfo(packageName, options);
		typings[packageName] = data;

		// Flush detailed log
		detailedLog(`# ${packageName}`);
		moveLogs(detailedLog, logs);
	}

	await Promise.all([
		writeLog("parser-log-summary.md", summaryLogResult()),
		writeLog("parser-log-details.md", detailedLogResult()),
		writeDataFile(typesDataFilename, typings)
	]);
}

async function single(singleName: string, options: Options): Promise<void> {
	const result = await parser.getTypingInfo(singleName, options);
	const typings = { [singleName]: result.data };
	await writeDataFile(typesDataFilename, typings);
	console.log(JSON.stringify(result, undefined, 4));
}
