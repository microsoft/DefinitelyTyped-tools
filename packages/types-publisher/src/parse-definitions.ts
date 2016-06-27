import * as parser from "./lib/definition-parser";
import { TypingsData, RejectionReason, settings, isSuccess, isFail, writeLogSync, writeDataFile, typesDataFilename } from "./lib/common";

import fs = require("fs");
import path = require("path");

function processDir(folderPath: string, name: string): { data: TypingsData, log: string[], warnings: string[], outcome: string } {
	let data: TypingsData;
	let outcome: string;

	const info = parser.getTypingInfo(folderPath);
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

function filterPaths(paths: string[]): { name: string; path: string; }[] {
	return paths
		// Remove hidden paths
		.filter(s => s.substr(0, 1) !== "_" && s.substr(0, 1) !== ".")
		// Sort by name
		.sort()
		// Combine paths
		.map(s => ({ name: s, path: path.join(settings.definitelyTypedPath, s) }))
		// Remove non-folders
		.filter(s => fs.statSync(s.path).isDirectory());
}

function main() {
	const summaryLog: string[] = [];
	const detailedLog: string[] = [];

	summaryLog.push("# Typing Publish Report Summary");
	summaryLog.push(`Started at ${(new Date()).toUTCString()}`);

	// TypesData
	fs.readdir(settings.definitelyTypedPath, (err, paths) => {
		const folders = filterPaths(paths);

		summaryLog.push(`Found ${folders.length} typings folders in ${settings.definitelyTypedPath}`);

		const outcomes: { [name: string]: number} = {};
		const warningLog: string[] = [];
		const typings: { [name: string]: TypingsData } = {};

		folders.forEach(s => {
			const result = processDir(s.path, s.name);

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
		});

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
	});
}

main();
