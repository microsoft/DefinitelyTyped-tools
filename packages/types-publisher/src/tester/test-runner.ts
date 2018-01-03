import { pathExists } from "fs-extra";
import * as yargs from "yargs";

import { Options } from "../lib/common";
import { AllPackages, TypingsData } from "../lib/packages";
import { npmInstallFlags } from "../util/io";
import { consoleLogger, LoggerWithErrors } from "../util/logging";
import { concat, done, exec, execAndThrowErrors, joinPaths, nAtATime, numberOfOsProcesses, runWithListeningChildProcesses } from "../util/util";

import getAffectedPackages, { Affected, allDependencies } from "./get-affected-packages";

if (!module.parent) {
	const selection = yargs.argv.all ? "all" : yargs.argv._[0] ? new RegExp(yargs.argv._[0]) : "affected";
	done(main(testerOptions(!!yargs.argv.runFromDefinitelyTyped), parseNProcesses(), selection));
}

const pathToDtsLint = require.resolve("dtslint");

export function parseNProcesses(): number {
	const str = yargs.argv.nProcesses;
	if (!str) {
		return numberOfOsProcesses;
	}
	const nProcesses = Number.parseInt(yargs.argv.nProcesses, 10);
	if (Number.isNaN(nProcesses)) {
		throw new Error("Expected nProcesses to be a number.");
	}
	return nProcesses;
}

export function testerOptions(runFromDefinitelyTyped: boolean): Options {
	if (runFromDefinitelyTyped) {
		return new Options(process.cwd(), /*resetDefinitelyTyped*/ false, /*progress*/ false, /*parseInParallel*/ true);
	} else {
		return Options.defaults;
	}
}

export default async function main(options: Options, nProcesses: number, selection: "all" | "affected" | RegExp): Promise<void> {
	const allPackages = await AllPackages.read(options);
	const { changedPackages, dependentPackages }: Affected = selection === "all"
		? { changedPackages: allPackages.allTypings(), dependentPackages: [] }
		: selection === "affected"
		? await getAffectedPackages(allPackages, consoleLogger.info, options)
		: { changedPackages: allPackages.allTypings().filter(t => selection.test(t.name)), dependentPackages: [] };

	console.log(`Testing ${changedPackages.length} changed packages: ${changedPackages.map(t => t.desc)}`);
	console.log(`Testing ${dependentPackages.length} dependent packages: ${dependentPackages.map(t => t.desc)}`);
	console.log(`Running with ${nProcesses} processes.`);

	await doInstalls(allPackages, concat(changedPackages, dependentPackages), options, nProcesses);

	console.log("Testing...");
	await runTests([...changedPackages, ...dependentPackages], new Set(changedPackages), options, nProcesses);
}

async function doInstalls(allPackages: AllPackages, packages: Iterable<TypingsData>, options: Options, nProcesses: number): Promise<void> {
	console.log("Installing NPM dependencies...");

	// We need to run `npm install` for all dependencies, too, so that we have dependencies' dependencies installed.
	await nAtATime(nProcesses, allDependencies(allPackages, packages), async pkg => {
		const cwd = pkg.directoryPath(options);
		if (!await pathExists(joinPaths(cwd, "package.json"))) {
			return;
		}

		// Scripts may try to compile native code.
		// This doesn't work reliably on travis, and we're just installing for the types, so ignore.
		const cmd = `npm install ${npmInstallFlags}`;
		console.log(`  ${cwd}: ${cmd}`);
		const stdout = await execAndThrowErrors(cmd, cwd);
		if (stdout) {
			// Must specify what this is for since these run in parallel.
			console.log(` from ${cwd}: ${stdout}`);
		}
	});

	await runCommand(console, undefined, pathToDtsLint, ["--installAll"]);
}

async function runTests(
	packages: ReadonlyArray<TypingsData>,
	changed: ReadonlySet<TypingsData>,
	options: Options,
	nProcesses: number,
): Promise<void> {
	const allFailures: Array<[string, string]> = [];

	await runWithListeningChildProcesses({
		inputs: packages.map(p => ({ path: p.subDirectoryPath, onlyTestTsNext: !changed.has(p) })),
		commandLineArgs: ["--listen"],
		workerFile: pathToDtsLint,
		nProcesses,
		cwd: options.typesPath,
		handleOutput(output): void {
			const { path, status } = output as { path: string, status: string };
			if (status === "OK") {
				console.log(`${path} OK`);
			} else {
				console.error(`${path} failing:`);
				console.error(status);
				allFailures.push([path, status]);
			}
		},
	});

	if (allFailures.length === 0) {
		return;
	}

	console.error("\n\n=== ERRORS ===\n");

	for (const [path, error] of allFailures) {
		console.error(`\n\nError in ${path}`);
		console.error(error);
	}

	console.error(`The following packages had errors: ${allFailures.map(e => e[0]).join(", ")}`);
}

interface TesterError {
	message: string;
}

async function runCommand(log: LoggerWithErrors, cwd: string | undefined, cmd: string, args: string[]): Promise<TesterError | undefined> {
	const nodeCmd = `node ${cmd} ${args.join(" ")}`;
	log.info(`Running: ${nodeCmd}`);
	try {
		const { error, stdout, stderr } = await exec(nodeCmd, cwd);
		if (stdout) {
			log.info(stdout);
		}
		if (stderr) {
			log.error(stderr);
		}

		return error && { message: `${error.message}\n${stdout}\n${stderr}` };
	} catch (e) {
		return e;
	}
}
