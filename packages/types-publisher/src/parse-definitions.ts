import * as parser from "./lib/definition-parser";
import * as yargs from "yargs";
import { TypingsData, RejectionReason, settings, definitelyTypedPath, isSuccess, isFail, writeLogSync, writeDataFile, typesDataFilename } from "./lib/common";
import { done, filterAsyncOrdered } from "./lib/util";

import fsp = require("fs-promise");

if (!module.parent) {
	const singleName = yargs.argv.single;
	done((singleName ? single(singleName) : main()));
}

async function processDir(name: string): Promise<{ data: TypingsData, log: string[], warnings: string[], outcome: string }> {
	let data: TypingsData;
	let outcome: string;

	const info = await parser.getTypingInfo(name);
	const log = info.log;
	if (isSuccess(info)) {
		data = info.data;
		outcome = `Succeeded (${info.data.kind})`;

	} else if (isFail(info)) {
		data = undefined;
		outcome =  `Failed (${RejectionReason[info.rejectionReason]})`;
	}

	return { data, log, warnings: info.warnings, outcome: outcome };
}

async function filterPaths(paths: string[]): Promise<string[]> {
	const fullPaths = paths
		// Remove hidden paths and node_modules
		.filter(s => s[0] !== "_" && s[0] !== "." && s !== "node_modules")
		// Sort by name
		.sort();
	// Remove non-folders
	return filterAsyncOrdered(fullPaths, async s => (await fsp.stat(definitelyTypedPath(s))).isDirectory());
}

export default async function main(): Promise<void> {
	const summaryLog: string[] = [];
	const detailedLog: string[] = [];

	summaryLog.push("# Typing Publish Report Summary");
	summaryLog.push(`Started at ${(new Date()).toUTCString()}`);

	// TypesData
	const paths = await fsp.readdir(settings.definitelyTypedPath);

	const folders = await filterPaths(paths);

	summaryLog.push(`Found ${folders.length} typings folders in ${settings.definitelyTypedPath}`);

	const outcomes: { [name: string]: number} = {};
	const warningLog: string[] = [];
	const typings: { [name: string]: TypingsData } = {};

	for (const s of folders) {
		const result = await processDir(s);

		// Record outcome
		outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;

		detailedLog.push(`# ${s}`);

		// Push warnings
		if (result.warnings.length > 0) {
			warningLog.push(` * ${s}`);
			result.warnings.forEach(w => {
				warningLog.push(`   * ${w}`);
				detailedLog.push(`**Warning**: ${w}`);
			});
		}

		if (result.data !== undefined) {
			typings[s] = result.data;
		}

		// Flush detailed log
		result.log.forEach(e => detailedLog.push(e));
	}

	summaryLog.push("\r\n### Overall Results\r\n");

	summaryLog.push(" * Pass / fail");

	const outcomeKeys = Object.keys(outcomes);
	outcomeKeys.sort();
	outcomeKeys.forEach(k => {
		summaryLog.push(`   * ${k}: ${outcomes[k]}`);
	});

	summaryLog.push("\r\n### Warnings\r\n");
	warningLog.forEach(w => summaryLog.push(w));

	writeLogSync("parser-log-summary.md", summaryLog);
	writeLogSync("parser-log-details.md", detailedLog);
	writeDataFile(typesDataFilename, typings);
}

async function single(singleName: string): Promise<void> {
	const result = await processDir(singleName);
	const typings = { [singleName]: result.data };
	writeDataFile(typesDataFilename, typings);
	console.log(result);
}
