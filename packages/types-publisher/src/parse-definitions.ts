import * as yargs from "yargs";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options, writeDataFile } from "./lib/common";
import { getTypingInfo } from "./lib/definition-parser";
import { definitionParserWorkerFilename, TypingInfoWithPackageName } from "./lib/definition-parser-worker";
import { AllPackages, readNotNeededPackages, typesDataFilename, TypingsVersionsRaw } from "./lib/packages";
import { parseNProcesses } from "./tester/test-runner";
import { logger, moveLogs, quietLogger, writeLog } from "./util/logging";
import { assertDefined, done, filterNAtATime, runWithChildProcesses } from "./util/util";

if (!module.parent) {
	const singleName = yargs.argv.single;
	const options = Options.defaults;
	done(async () => {
		const dt = await getDefinitelyTyped(options);
		if (singleName)  {
			await single(singleName, dt);
		} else {
			await main(dt, options.parseInParallel
				? { nProcesses: parseNProcesses(), definitelyTypedPath: assertDefined(options.definitelyTypedPath) }
				: undefined);
		}
	});
}

export default async function main(dt: FS, parallel?: { readonly nProcesses: number; readonly definitelyTypedPath: string }): Promise<AllPackages> {
	const [summaryLog, summaryLogResult] = logger();
	const [detailedLog, detailedLogResult] = quietLogger();

	summaryLog("# Typing Publish Report Summary");
	summaryLog(`Started at ${(new Date()).toUTCString()}`);

	const typesFS = dt.subDir("types");
	const packageNames = await filterNAtATime(parallel ? parallel.nProcesses : 1, await typesFS.readdir(), name => typesFS.isDirectory(name));

	summaryLog(`Found ${packageNames.length} typings folders`);

	const typings: { [name: string]: TypingsVersionsRaw } = {};

	if (parallel) {
		await runWithChildProcesses({
			inputs: packageNames,
			commandLineArgs: [`${parallel.definitelyTypedPath}/types`],
			workerFile: definitionParserWorkerFilename,
			nProcesses: parallel.nProcesses,
			handleOutput,
		});
	} else {
		for (const packageName of packageNames) {
			handleOutput({ ...await getTypingInfo(packageName, typesFS.subDir(packageName)), packageName });
		}
	}

	function handleOutput({ data, logs, packageName }: TypingInfoWithPackageName): void {
		typings[packageName] = data;
		detailedLog(`# ${packageName}`);
		moveLogs(detailedLog, logs);
	}

	await Promise.all([
		writeLog("parser-log-summary.md", summaryLogResult()),
		writeLog("parser-log-details.md", detailedLogResult()),
		writeDataFile(typesDataFilename, sorted(typings)),
	]);

	return AllPackages.from(typings, await readNotNeededPackages(dt));
}

function sorted<T>(obj: { [name: string]: T }): { [name: string]: T } {
	const out: { [name: string]: T } = {};
	for (const key of Object.keys(obj).sort()) {
		out[key] = obj[key];
	}
	return out;
}

async function single(singleName: string, dt: FS): Promise<void> {
	const result = await getTypingInfo(singleName, dt.subDir(`types/${singleName}`));
	const typings = { [singleName]: result.data };
	await writeDataFile(typesDataFilename, typings);
	console.log(JSON.stringify(result, undefined, 4));
}
