import * as yargs from "yargs";

import * as parser from "./lib/definition-parser";
import { Options, writeDataFile } from "./lib/common";
import { TypingsDataRaw, definitelyTypedPath, typesDataFilename } from "./lib/packages";
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
		.filter(s => s[0] !== "." && s[0] !== "_" && s !== "node_modules" && s !== "scripts")
		// Sort by name
		.sort();
	// Remove non-folders
	return filterAsyncOrdered(fullPaths, async s => (await fsp.stat(definitelyTypedPath(s, options))).isDirectory());
}

export default async function main(options: Options): Promise<void> {
	const [summaryLog, summaryLogResult] = logger();
	const [detailedLog, detailedLogResult] = quietLogger();

	summaryLog("# Typing Publish Report Summary");
	summaryLog(`Started at ${(new Date()).toUTCString()}`);

	// TypesData
	const paths = await fsp.readdir(options.definitelyTypedPath);

	const folders = await filterPaths(paths, options);

	summaryLog(`Found ${folders.length} typings folders in ${options.definitelyTypedPath}`);

	const typings: { [name: string]: TypingsDataRaw } = {};

	await nAtATime(1, folders, use, { name: "Parsing...", flavor: name => name });
	async function use(pkgName: string): Promise<void> {
		const { data, logs } = await parser.getTypingInfo(pkgName, options);
		detailedLog(`# ${pkgName}`);
		typings[pkgName] = data;

		// Flush detailed log
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
	console.log(result);
}
