import * as fsp from "fs-promise";
import * as path from "path";
import * as child_process from "child_process";
import * as yargs from "yargs";
import { nAtATime, writeFile, writeJson } from "./lib/util";
import { existsTypesDataFileSync, settings, readTypings } from "./lib/common";
import { LoggerWithErrors, quietLoggerWithErrors, loggerWithErrors, moveLogsWithErrors, writeLog } from "./lib/logging";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	} else {
		const packageNames = yargs.argv._;
		main(packageNames);
	}
}

export default async function main(packageNames?: string[]) {
	const [log, logResult] = loggerWithErrors();

	if (!packageNames || !packageNames.length) {
		log.info("Validating all packages");
		packageNames = (await readTypings()).map(t => t.typingsPackageName).sort();
	}
	else {
		log.info("Validating: " + JSON.stringify(packageNames));
	}

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

	log.info(`These packages failed: ${failed}`);
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
function runCommand(commandDescription: string, log: LoggerWithErrors, directory: string, cmd: string, ...args: string[]): Promise<boolean> {
	const nodeCmd = `node ${cmd} ${args.join(" ")}`;
	log.info(`Run ${nodeCmd}`);
	return new Promise<boolean>((resolve, reject) => {
		child_process.exec(nodeCmd, { encoding: "utf8", cwd: directory }, (err, stdoutBuffer, stderrBuffer) => {
			// These are wrongly typed as Buffer.
			const stdout = <string> <any> stdoutBuffer;
			const stderr = <string> <any> stderrBuffer;
			if (err) {
				log.error(stderr);
				log.info(stdout);
				log.error(`${commandDescription} failed: ${JSON.stringify(err)}`);
				log.info(`${commandDescription} failed, refer to error log`);
				resolve(false);
			}
			else {
				log.info(stdout);
				resolve(true);
			}
		});
	});
}
