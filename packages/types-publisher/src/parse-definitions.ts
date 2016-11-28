import * as yargs from "yargs";

import * as parser from "./lib/definition-parser";
import { Options, TypingsData, definitelyTypedPath, writeDataFile, typesDataFilename } from "./lib/common";
import { logger, quietLogger, moveLogs, writeLog } from "./util/logging";
import { done, filterAsyncOrdered } from "./util/util";

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

	const [warningLog, warningLogResult] = logger();
	const typings: { [name: string]: TypingsData } = {};

	for (const s of folders) {
		const result = await parser.getTypingInfo(s, options);

		detailedLog(`# ${s}`);

		// Push warnings
		if (result.logs.errors.length > 0) {
			warningLog(` * ${s}`);
			result.logs.errors.forEach(w => {
				warningLog(`   * ${w}`);
				detailedLog(`**Warning**: ${w}`);
			});
		}

		if (result.data !== undefined) {
			typings[s] = result.data;
		}

		// Flush detailed log
		result.logs.infos.forEach(e => detailedLog(e));
	}

	summaryLog("\r\n### Overall Results\r\n");

	summaryLog("\r\n### Warnings\r\n");
	moveLogs(summaryLog, warningLogResult());

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
