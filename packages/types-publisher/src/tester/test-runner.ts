import { pathExists } from "fs-extra";
import * as yargs from "yargs";

import { Options } from "../lib/common";
import { AllPackages, PackageBase, TypingsData } from "../lib/packages";
import { LoggerWithErrors, moveLogsWithErrors, quietLoggerWithErrors } from "../util/logging";
import { done, exec, execAndThrowErrors, joinPaths, nAtATime, numberOfOsProcesses } from "../util/util";

import getAffectedPackages, { allDependencies } from "./get-affected-packages";

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
		return new Options(process.cwd(), /*resetDefinitelyTyped*/ false, /*progress*/ false);
	} else {
		return Options.defaults;
	}
}

export default async function main(options: Options, nProcesses: number, selection: "all" | "affected" | RegExp): Promise<void> {
	const allPackages = await AllPackages.read(options);
	const typings = selection === "all"
		? allPackages.allTypings()
		: selection === "affected"
		? await getAffectedPackages(allPackages, console.log, options)
		: allPackages.allTypings().filter(t => selection.test(t.name));

	console.log(`Testing ${typings.length} packages: ${typings.map(t => t.desc)}`);
	console.log(`Running with ${nProcesses} processes.`);

	const allErrors: Array<{ pkg: TypingsData, err: TesterError }> = [];

	console.log("Installing NPM dependencies...");

	// We need to run `npm install` for all dependencies, too, so that we have dependencies' dependencies installed.
	await nAtATime(nProcesses, allDependencies(allPackages, typings), async pkg => {
		const cwd = pkg.directoryPath(options);
		if (!await pathExists(joinPaths(cwd, "package.json"))) {
			return;
		}

		// Scripts may try to compile native code.
		// This doesn't work reliably on travis, and we're just installing for the types, so ignore.
		const cmd = "npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links";
		console.log(`  ${cwd}: ${cmd}`);
		const stdout = await execAndThrowErrors(cmd, cwd);
		if (stdout) {
			// Must specify what this is for since these run in parallel.
			console.log(` from ${cwd}: ${stdout}`);
		}
	});

	await runCommand(console, undefined, pathToDtsLint, "--installAll");

	console.log("Testing...");

	await nAtATime(nProcesses, typings, async pkg => {
		const [log, logResult] = quietLoggerWithErrors();
		const err = await single(pkg, log, options);
		console.log(`Testing ${pkg.desc}`);
		moveLogsWithErrors(console, logResult(), msg => `\t${msg}`);
		if (err) {
			allErrors.push({ err, pkg });
		}
	});

	if (allErrors.length) {
		allErrors.sort(({ pkg: pkgA }, { pkg: pkgB}) => PackageBase.compare(pkgA, pkgB));

		console.log("\n\n=== ERRORS ===\n");
		for (const { err, pkg } of allErrors) {
			console.error(`\n\nError in ${pkg.desc}`);
			console.error(err.message);
		}

		console.error(`The following packages had errors: ${allErrors.map(e => e.pkg.desc).join(", ")}`);

		throw new Error("There was a test failure.");
	}
}

async function single(pkg: TypingsData, log: LoggerWithErrors, options: Options): Promise<TesterError | undefined> {
	const cwd = pkg.directoryPath(options);
	const shouldLint = await pathExists(joinPaths(cwd, "tslint.json"));
	const args = shouldLint ? [] : ["--noLint"];
	return runCommand(log, cwd, pathToDtsLint, ...args);
}

interface TesterError {
	message: string;
}

async function runCommand(log: LoggerWithErrors, cwd: string | undefined, cmd: string, ...args: string[]): Promise<TesterError | undefined> {
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
