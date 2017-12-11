import { readdir, stat } from "fs-extra";
import * as path from "path";
import * as yargs from "yargs";

import { Options, writeDataFile } from "./lib/common";
import { getTypingInfo } from "./lib/definition-parser";
import { definitionParserWorkerFilename, TypingInfoWithPackageName } from "./lib/definition-parser-worker";
import { typesDataFilename, TypingsVersionsRaw } from "./lib/packages";
import { parseNProcesses } from "./tester/test-runner";
import { logger, moveLogs, quietLogger, writeLog } from "./util/logging";
import { done, filterNAtATime, runWithChildProcesses } from "./util/util";

if (!module.parent) {
	const singleName = yargs.argv.single;
	done((singleName ? single(singleName, Options.defaults) : main(Options.defaults, parseNProcesses())));
}

export default async function main(options: Options, nProcesses: number): Promise<void> {
	const [summaryLog, summaryLogResult] = logger();
	const [detailedLog, detailedLogResult] = quietLogger();

	summaryLog("# Typing Publish Report Summary");
	summaryLog(`Started at ${(new Date()).toUTCString()}`);

	const packageNames = await filterNAtATime(10, await readdir(options.typesPath), async packageName =>
		(await stat(path.join(options.typesPath, packageName))).isDirectory());

	summaryLog(`Found ${packageNames.length} typings folders in ${options.typesPath}`);

	const typings: { [name: string]: TypingsVersionsRaw } = {};

	await runWithChildProcesses({
		inputs: packageNames,
		commandLineArgs: [options.typesPath],
		workerFile: definitionParserWorkerFilename,
		nProcesses,
		handleOutput(output): void {
			const { data, logs, packageName } = output as TypingInfoWithPackageName;
			typings[packageName] = data;
			detailedLog(`# ${packageName}`);
			moveLogs(detailedLog, logs);
		}
	});

	await Promise.all([
		writeLog("parser-log-summary.md", summaryLogResult()),
		writeLog("parser-log-details.md", detailedLogResult()),
		writeDataFile(typesDataFilename, typings)
	]);
}

async function single(singleName: string, options: Options): Promise<void> {
	const result = await getTypingInfo(singleName, options.typesPath);
	const typings = { [singleName]: result.data };
	await writeDataFile(typesDataFilename, typings);
	console.log(JSON.stringify(result, undefined, 4));
}
