import * as fsp from "fs-promise";
import * as path from "path";
import * as yargs from "yargs";

import { Options, existsTypesDataFileSync, settings, readAllPackagesArray, readTypings } from "./lib/common";
import { writeFile, writeJson } from "./util/io";
import { LoggerWithErrors, quietLoggerWithErrors, loggerWithErrors, moveLogsWithErrors, writeLog } from "./util/logging";
import { done, exec, nAtATime } from "./util/util";
import { changedPackages } from "./lib/versions";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const all = !!yargs.argv.all;
		const packageNames = yargs.argv._;
		if (all && packageNames) {
			throw new Error("Can't combine --all with listed package names.");
		}

		if (all) {
			console.log("Validating all packages");
			done(doAll());
		}
		else if (packageNames.length) {
			console.log("Validating: " + JSON.stringify(packageNames));
			done(doValidate(packageNames));
		}
		else {
			main(Options.defaults);
		}
	}
}

export default async function main(options: Options): Promise<void> {
	const changed = await changedPackages(await readAllPackagesArray(options));
	await doValidate(changed.map(c => c.typingsPackageName));
}

async function doAll(): Promise<void> {
	const packageNames = (await readTypings()).map(t => t.typingsPackageName).sort();
	await doValidate(packageNames);
}

async function doValidate(packageNames: string[]): Promise<void> {
	const [log, logResult] = loggerWithErrors();
	await validatePackages(packageNames, settings.validateOutputPath, log);
	const {infos, errors} = logResult();
	await Promise.all([
		writeLog("validate.md", infos),
		writeLog("validate-errors.md", errors)
	]);
}

async function validatePackages(packageNames: string[], outPath: string, log: LoggerWithErrors) {
	log.info("");
	log.info("Using output path: " + outPath);
	log.info("Running tests....");
	log.info("");
	const failed: string[] = [];
	const passed: string[] = [];
	try {
		await fsp.remove(outPath);
		await fsp.mkdirp(outPath);
	}
	catch (e) {
		log.error("Could not recreate output directory. " + e);
		return;
	}

	// Run the tests
	await nAtATime(25, packageNames, async packageName => {
		if (await validatePackage(packageName, outPath, log)) {
			passed.push(packageName);
		}
		else {
			failed.push(packageName);
		}
	});

	// Write results
	log.info("");
	log.info("");
	log.info(`Total  ${packageNames.length}`);
	log.info(`Passed ${passed.length}`);
	log.info(`Failed ${failed.length}`);
	log.info("");

	if (failed.length) {
		log.info(`These packages failed: ${failed}`);
	}
}

async function validatePackage(packageName: string, outputDirecory: string, mainLog: LoggerWithErrors) {
	const [log, logResult] = quietLoggerWithErrors();
	let passed = false;
	try {
		const packageDirectory = path.join(outputDirecory, packageName);
		log.info("");
		log.info("Processing `" + packageName + "`...");
		await fsp.mkdirp(packageDirectory);
		await writePackage(packageDirectory, packageName);
		if (await runCommand("npm", log, packageDirectory, "../../node_modules/npm/bin/npm-cli.js", "install") &&
			await runCommand("tsc", log, packageDirectory, "../../node_modules/typescript/lib/tsc.js")) {
			await fsp.remove(packageDirectory);
			log.info("Passed.");
			passed = true;
		}
	}
	catch (e) {
		log.info("Error: " + e);
		log.info("Failed!");
	}

	// Write the log as one entry to the main log
	moveLogsWithErrors(mainLog, logResult());

	console.info(`${packageName} -- ${passed ? "Passed" : "Failed"}.`);
	return passed;
}

async function writePackage(packageDirectory: string, packageName: string) {
	// Write package.json
	await writeJson(path.join(packageDirectory, "package.json"), {
		name: `${packageName}_test`,
		version: "1.0.0",
		description: "test",
		author: "",
		license: "ISC",
		repository: "https://github.com/Microsoft/types-publisher",
		dependencies: { [`@types/${packageName}`]: settings.tag }
	});

	// Write tsconfig.json
	await writeJson(path.join(packageDirectory, "tsconfig.json"), {
		compilerOptions: {
			module: "commonjs",
			target: "es5",
			noImplicitAny: false,
			strictNullChecks: false,
			noEmit: true,
			lib: ["es5", "es2015.promise", "dom"]
		}
	});

	// Write index.ts
	await writeFile(path.join(packageDirectory, "index.ts"), `/// <reference types="${packageName}" />\r\n`);
}

// Returns whether the command succeeded.
async function runCommand(commandDescription: string, log: LoggerWithErrors, directory: string, cmd: string, ...args: string[]): Promise<boolean> {
	const nodeCmd = `node ${cmd} ${args.join(" ")}`;
	log.info(`Run ${nodeCmd}`);
	const { error, stdout, stderr } = await exec(nodeCmd, directory);
	if (error) {
		log.error(stderr);
		log.info(stdout);
		log.error(`${commandDescription} failed: ${JSON.stringify(error)}`);
		log.info(`${commandDescription} failed, refer to error log`);
		return false;
	}
	else {
		log.info(stdout);
		return true;
	}
}
