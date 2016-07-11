import * as parser from "./lib/definition-parser";
import { TypingsData, RejectionReason, settings, isSuccess, isFail, writeLogSync, writeDataFile, typesDataFilename } from "./lib/common";
import { filterAsyncOrdered } from "./lib/util";

import fsp = require("fs-promise");
import path = require("path");

if (!module.parent) {
	main().catch(console.error);
}

async function processDir(folderPath: string, name: string): Promise<{ data: TypingsData, log: string[], warnings: string[], outcome: string }> {
	let data: TypingsData;
	let outcome: string;

	const info = await parser.getTypingInfo(folderPath);
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

async function filterPaths(paths: string[]): Promise<{ name: string; path: string; }[]> {
	const fullPaths = paths
		// Remove hidden paths and node_modules
		.filter(s => s[0] !== "_" && s[0] !== "." && s !== "node_modules")
		// Sort by name
		.sort()
		// Combine paths
		.map(s => ({ name: s, path: path.join(settings.definitelyTypedPath, s) }));
	// Remove non-folders
	return filterAsyncOrdered(fullPaths, async s => (await fsp.stat(s.path)).isDirectory());
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
		const result = await processDir(s.path, s.name);

		// Record outcome
		outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;

		detailedLog.push(`# ${s.name}`);

		// Push warnings
		if (result.warnings.length > 0) {
			warningLog.push(` * ${s.name}`);
			result.warnings.forEach(w => {
				warningLog.push(`   * ${w}`);
				detailedLog.push(`**Warning**: ${w}`);
			});
		}

		if (result.data !== undefined) {
			typings[s.name] = result.data;
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

main().catch(console.error);
