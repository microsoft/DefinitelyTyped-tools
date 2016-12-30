import * as fsp from "fs-promise";
import * as path from "path";
import * as yargs from "yargs";

import { Options } from "../lib/common";
import { AllPackages, TypeScriptVersion, TypingsData } from "../lib/packages";
import { readJson } from "../util/io";
import { LoggerWithErrors, moveLogsWithErrors, quietLoggerWithErrors } from "../util/logging";
import { done, exec, execAndThrowErrors, nAtATime, numberOfOsProcesses } from "../util/util";

import getAffectedPackages, { allDependencies } from "./get-affected-packages";
import { installAllTypeScriptVersions, pathToTsc } from "./ts-installer";

const tslintPath = path.join(require.resolve("tslint"), "../tslint-cli.js");

if (!module.parent) {
	const regexp = yargs.argv.all ? new RegExp("") : yargs.argv._[0] && new RegExp(yargs.argv._[0]);
	done(main(testerOptions(!!yargs.argv.runFromDefinitelyTyped), parseNProcesses(), regexp));
}

export function parseNProcesses(): number | undefined {
	const str = yargs.argv.nProcesses;
	if (!str) {
		return undefined;
	}
	const nProcesses = Number.parseInt(yargs.argv.nProcesses, 10);
	if (Number.isNaN(nProcesses)) {
		throw new Error("Expected nProcesses to be a number.");
	}
	return nProcesses;
}

export function testerOptions(runFromDefinitelyTyped: boolean): Options {
	if (runFromDefinitelyTyped) {
		return { definitelyTypedPath: process.cwd() };
	} else {
		return Options.defaults;
	}
}

export default async function main(options: Options, nProcesses?: number, regexp?: RegExp): Promise<void> {
	await installAllTypeScriptVersions();

	const allPackages = await AllPackages.read(options);
	const typings: TypingsData[] = regexp
		? allPackages.allTypings().filter(t => regexp.test(t.typingsPackageName))
		: await getAffectedPackages(allPackages, console.log, options);

	nProcesses = nProcesses || numberOfOsProcesses;

	console.log(`Testing ${typings.length} packages: ${typings.map(t => t.typingsPackageName)}`);
	console.log(`Running with ${nProcesses} processes.`);

	const allErrors: Array<{ pkg: TypingsData, err: TesterError }> = [];

	console.log("Installing dependencies...");

	await nAtATime(nProcesses, allDependencies(allPackages, typings), async pkg => {
		const cwd = pkg.directoryPath(options);
		if (await fsp.exists(path.join(cwd, "package.json"))) {
			let stdout = await execAndThrowErrors(`npm install`, cwd);
			stdout = stdout.replace(/npm WARN \S+ No (description|repository field\.|license field\.)\n?/g, "");
			if (stdout) {
				console.log(stdout);
			}
		}
	});

	console.log("Testing...");

	await nAtATime(nProcesses, typings, async pkg => {
		const [log, logResult] = quietLoggerWithErrors();
		const err = await single(pkg, log, options);
		console.log(`Testing ${pkg.typingsPackageName}`);
		moveLogsWithErrors(console, logResult(), msg => "\t" + msg);
		if (err) {
			allErrors.push({ err, pkg });
		}
	});

	if (allErrors.length) {
		allErrors.sort(({ pkg: pkgA }, { pkg: pkgB}) => pkgA.typingsPackageName.localeCompare(pkgB.typingsPackageName));

		console.log("\n\n=== ERRORS ===\n");
		for (const { err, pkg } of allErrors) {
			console.error(`Error in ${pkg.typingsPackageName}`);
			console.error(err.message);
		}

		throw new Error("There was a test failure.");
	}
}

async function single(pkg: TypingsData, log: LoggerWithErrors, options: Options): Promise<TesterError | undefined> {
	const cwd = pkg.directoryPath(options);
	return (await tsConfig()) || (await packageJson()) || (await tsc()) || (await tslint());

	async function tsConfig(): Promise<TesterError | undefined> {
		const tsconfigPath = path.join(cwd, "tsconfig.json");
		return catchErrors(log, async () =>
			checkTsconfig(await readJson(tsconfigPath)));
	}
	async function packageJson(): Promise<TesterError | undefined> {
		return catchErrors(log, () => checkPackageJson(pkg, options));
	}
	async function tsc(): Promise<TesterError | undefined> {
		const error = await runCommand(log, cwd, pathToTsc(pkg.typeScriptVersion));
		if (error && pkg.typeScriptVersion !== TypeScriptVersion.Latest) {
			const newError = await runCommand(log, cwd, pathToTsc(TypeScriptVersion.Latest));
			if (!newError) {
				const message = `${error.message}\n` +
					`Package compiles in TypeScript ${TypeScriptVersion.Latest} but not in ${pkg.typeScriptVersion}.\n` +
					`You can add a line '// TypeScript Version: ${TypeScriptVersion.Latest}' to the end of the header to specify a new compiler version.`;
				return { message };
			}
		}
		return error;
	}
	async function tslint(): Promise<TesterError | undefined> {
		return (await fsp.exists(path.join(cwd, "tslint.json")))
			? runCommand(log, cwd, tslintPath, "--format stylish", ...pkg.files)
			: undefined;
	}
}

async function catchErrors(log: LoggerWithErrors, action: () => Promise<void>): Promise<TesterError | undefined> {
	try {
		await action();
	}
	catch (error) {
		log.error(error.message);
		return { message: error.message };
	}
	return undefined;
}

interface TesterError {
	message: string;
}

async function runCommand(log: LoggerWithErrors, cwd: string | undefined, cmd: string, ...args: string[]): Promise<TesterError | undefined> {
	const nodeCmd = `node ${cmd} ${args.join(" ")}`;
	log.info(`Running: ${nodeCmd}`);
	const { error, stdout, stderr } = await exec(nodeCmd, cwd);
	if (stdout) {
		log.info(stdout);
	}
	if (stderr) {
		log.error(stderr);
	}

	return error && { message: `${error.message}\n${stdout}\n${stderr}` };
}

function checkTsconfig(tsconfig: any) {
	const options = tsconfig.compilerOptions;
	const mustHave = {
		module: "commonjs",
		// target: "es6", // Some libraries use an ES5 target, such as es6-shim
		noEmit: true,
		forceConsistentCasingInFileNames: true
	};
	for (const [key, value] of Object.entries(mustHave)) {
		if (options[key] !== value) {
			throw new Error(`Expected compilerOptions[${JSON.stringify(key)}] === ${value}`);
		}
	}

	for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks"]) {
		if (!(key in options)) {
			throw new Error(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
		}
	}

	if (("typeRoots" in options) && !("types" in options)) {
		throw new Error('If the "typeRoots" option is specified in your tsconfig, you must include `"types": []` to prevent very long compile times.');
	}

	// baseUrl / typeRoots / types may be missing.
	if (options.types && options.types.length) {
		throw new Error(
			'Use `/// <reference types="..." />` directives in source files and ensure that the "types" field in your tsconfig is an empty array.');
	}
}

async function checkPackageJson(typing: TypingsData, options: Options): Promise<void> {
	if (!typing.hasPackageJson) {
		return;
	}

	const pkgJsonPath = typing.filePath("package.json", options);
	const pkgJson = await readJson(pkgJsonPath);

	const ignoredField = Object.keys(pkgJson).find(field => !["dependencies", "peerDependencies", "description"].includes(field));
	if (ignoredField) {
		throw new Error(`Ignored field in ${pkgJsonPath}: ${ignoredField}`);
	}
}
