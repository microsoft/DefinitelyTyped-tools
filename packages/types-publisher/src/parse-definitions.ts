import * as yargs from "yargs";

import * as parser from "./lib/definition-parser";
import { Options, TypingsData, RejectionReason, definitelyTypedPath, writeDataFile, typesDataFilename } from "./lib/common";
import { LogWithErrors, logger, quietLogger, moveLogs, writeLog } from "./util/logging";
import { done, filterAsyncOrdered } from "./util/util";

import fsp = require("fs-promise");

if (!module.parent) {
	const singleName = yargs.argv.single;
	done((singleName ? single(singleName, Options.defaults) : main(Options.defaults)));
}

async function processDir(name: string, options: Options): Promise<{ data: TypingsData | undefined, logs: LogWithErrors, outcome: string }> {
	let data: TypingsData | undefined;
	let outcome: string;

	const info = await parser.getTypingInfo(name, options);
	const logs = info.logs;

	if (info.kind === "success") {
		data = info.data;
		outcome = `Succeeded (${info.data.kind})`;
	} else {
		data = undefined;
		outcome = `Failed (${RejectionReason[info.rejectionReason]})`;
	}

	return { data, logs, outcome };
}

async function filterPaths(paths: string[], options: Options): Promise<string[]> {
	const fullPaths = paths
		// Remove hidden paths and known non-package directories
		.filter(s => s[0] !== "." && s !== "_" && s !== "node_modules" && s !== "scripts")
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

	const outcomes: { [name: string]: number} = {};
	const [warningLog, warningLogResult] = logger();
	const typings: { [name: string]: TypingsData } = {};

	for (const s of folders) {
		const result = await processDir(s, options);

		// Record outcome
		outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;

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

	summaryLog(" * Pass / fail");

	const outcomeKeys = Object.keys(outcomes);
	outcomeKeys.sort();
	outcomeKeys.forEach(k => {
		summaryLog(`   * ${k}: ${outcomes[k]}`);
	});

	summaryLog("\r\n### Warnings\r\n");
	moveLogs(summaryLog, warningLogResult());

	await Promise.all([
		writeLog("parser-log-summary.md", summaryLogResult()),
		writeLog("parser-log-details.md", detailedLogResult()),
		writeDataFile(typesDataFilename, typings)
	]);
}

async function single(singleName: string, options: Options): Promise<void> {
	const result = await processDir(singleName, options);
	const typings = { [singleName]: result.data };
	await writeDataFile(typesDataFilename, typings);
	console.log(result);
}
