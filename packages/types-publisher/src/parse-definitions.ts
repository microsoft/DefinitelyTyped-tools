import * as yargs from "yargs";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options, writeDataFile } from "./lib/common";
import { getTypingInfo } from "./lib/definition-parser";
import { definitionParserWorkerFilename, TypingInfoWithPackageName } from "./lib/definition-parser-worker";
import { AllPackages, readNotNeededPackages, typesDataFilename, TypingsVersionsRaw } from "./lib/packages";
import { parseNProcesses } from "./tester/test-runner";
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
	const typesFS = dt.subDir("types");
	const packageNames = await filterNAtATime(parallel ? parallel.nProcesses : 1, await typesFS.readdir(), name => typesFS.isDirectory(name));

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
			handleOutput({ data: await getTypingInfo(packageName, typesFS.subDir(packageName)), packageName });
		}
	}

	function handleOutput({ data, packageName }: TypingInfoWithPackageName): void {
		typings[packageName] = data;
	}

	await writeDataFile(typesDataFilename, sorted(typings));

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
	const result = await getTypingInfo(singleName, dt.subDir("types").subDir(singleName));
	const typings = { [singleName]: result.data };
	await writeDataFile(typesDataFilename, typings);
	console.log(JSON.stringify(result, undefined, 4));
}
