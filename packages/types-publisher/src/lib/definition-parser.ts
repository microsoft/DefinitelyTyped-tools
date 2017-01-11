import * as fsp from "fs-promise";
import * as ts from "typescript";

import { readFile as readFileText } from "../util/io";
import { Log, moveLogs, quietLogger } from "../util/logging";
import { computeHash, hasWindowsSlashes, join, joinPaths, mapAsyncOrdered, makeObject } from "../util/util";

import { Options } from "./common";
import { parseHeaderOrFail } from "./header";
import getModuleInfo from "./module-info";
import { DependenciesRaw, TypingsDataRaw, TypingsVersionsRaw, packageRootPath } from "./packages";

export async function getTypingInfo(packageName: string, options: Options): Promise<{ data: TypingsVersionsRaw, logs: Log }> {
	if (packageName !== packageName.toLowerCase()) {
		throw new Error(`Package name \`${packageName}\` should be strictly lowercase`);
	}
	const rootDirectory = packageRootPath(packageName, options);
	const { rootDirectoryLs, olderVersionDirectories } = await getOlderVersions(rootDirectory);

	const { data: latestData, logs: latestLogs } = await getTypingData(packageName, rootDirectory, rootDirectoryLs);
	const latestVersion = latestData.libraryMajorVersion;

	const [log, logResult] = quietLogger();
	moveLogs(log, latestLogs);

	const older = await mapAsyncOrdered(olderVersionDirectories, async ({ directoryName, majorVersion }) => {
		if (majorVersion === latestVersion) {
			throw new Error(`The latest major version is ${latestVersion}, but a directory v${latestVersion} exists.`);
		}

		const directory = joinPaths(rootDirectory, directoryName);
		const files = await fsp.readdir(directory);
		const { data, logs } = await getTypingData(packageName, directory, files, majorVersion);
		log(`Parsing older version ${majorVersion}`);
		moveLogs(log, logs, (msg) => "    " + msg);

		if (data.libraryMajorVersion !== majorVersion) {
			throw new Error(`Directory ${directory} indicates major version ${majorVersion}, but header indicates major version ${data.libraryMajorVersion}`);
		}
		return data;
	});

	const data: TypingsVersionsRaw = {};
	data[latestVersion] = latestData;
	for (const o of older) {
		data[o.libraryMajorVersion] = o;
	}
	return { data, logs: logResult() };
}

interface OlderVersionDirectory { directoryName: string; majorVersion: number; }

async function getOlderVersions(rootDirectory: string): Promise<{ rootDirectoryLs: string[], olderVersionDirectories: OlderVersionDirectory[] }> {
	const lsRootDirectory = await fsp.readdir(rootDirectory);
	const rootDirectoryLs: string[] = [];
	const olderVersionDirectories: OlderVersionDirectory[] = [];
	for (const fileOrDirectoryName of lsRootDirectory) {
		const majorVersion = parseMajorVersionFromDirectoryName(fileOrDirectoryName);
		if (majorVersion === undefined) {
			rootDirectoryLs.push(fileOrDirectoryName);
		} else {
			olderVersionDirectories.push({ directoryName: fileOrDirectoryName, majorVersion });
		}
	}
	return { rootDirectoryLs, olderVersionDirectories };
}

export function parseMajorVersionFromDirectoryName(directoryName: string): number | undefined {
	const match = /^v(\d+)$/.exec(directoryName);
	return match === null ? undefined : Number(match[1]);
}

/**
 * @param packageName Name of the outermost directory; e.g. for "node/v4" this is just "node".
 * @param directory Full path to the directory for this package; e.g. "../DefinitelyTyped/foo/v3".
 * @param ls All file/directory names in `directory`.
 */
async function getTypingData(packageName: string, directory: string, ls: string[], oldMajorVersion?: number
	): Promise<{ data: TypingsDataRaw, logs: Log }> {
	const [log, logResult] = quietLogger();

	log(`Reading contents of ${directory}`);

	// There is a *single* main file, containing metadata comments.
	// But there may be many entryFilenames, which are the starting points of inferring all files to be included.
	const mainFilename = "index.d.ts";

	const { authors, libraryMajorVersion, libraryMinorVersion, typeScriptVersion, libraryName, projects } =
		parseHeaderOrFail(await readFile(directory, mainFilename), packageName);

	const { typeFiles, testFiles } = await entryFilesFromTsConfig(packageName, directory);
	const { dependencies: dependenciesSet, globals, declaredModules, declFiles } = await getModuleInfo(packageName, directory, typeFiles, log);
	const dependencies = await calculateDependencies(packageName, directory, dependenciesSet, oldMajorVersion);

	const hasPackageJson = await fsp.exists(joinPaths(directory, "package.json"));
	const allContentHashFiles = hasPackageJson ? declFiles.concat(["package.json"]) : declFiles;

	const allFiles = new Set(allContentHashFiles.concat(testFiles, ["tsconfig.json", "tslint.json"]));
	await checkAllFilesUsed(directory, ls, allFiles);

	// Double-check that no windows "\\" broke in.
	for (const fileName of allContentHashFiles) {
		if (hasWindowsSlashes(fileName)) {
			throw new Error(`In ${packageName}: windows slash detected in ${fileName}`);
		}
	}

	const sourceRepoURL = "https://www.github.com/DefinitelyTyped/DefinitelyTyped";
	const data: TypingsDataRaw = {
		authors: authors.map(a => `${a.name} <${a.url}>`).join(", "), // TODO: Store as JSON?
		dependencies,
		libraryMajorVersion,
		libraryMinorVersion,
		typeScriptVersion,
		libraryName,
		typingsPackageName: packageName,
		projectName: projects[0], // TODO: collect multiple project names
		sourceRepoURL,
		globals,
		declaredModules,
		files: declFiles,
		hasPackageJson,
		contentHash: await hash(directory, allContentHashFiles)
	};
	return { data, logs: logResult() };
}

async function entryFilesFromTsConfig(packageName: string, directory: string): Promise<{ typeFiles: string[], testFiles: string[] }> {
	const tsconfigPath = joinPaths(directory, "tsconfig.json");
	const tsconfig = await fsp.readJson(tsconfigPath);
	if (tsconfig.include) {
		throw new Error(`${tsconfigPath}: Don't use "include", must use "files"`);
	}

	const files: string[] = tsconfig.files;
	if (!files) {
		throw new Error(`${tsconfigPath} needs to specify  "files"`);
	}

	const typeFiles: string[] = [];
	const testFiles: string[] = [];

	for (const file of files) {
		if (file.startsWith("./")) {
			throw new Error(`In ${tsconfigPath}: Unnecessary "./" at the start of ${file}`);
		}

		if (file.endsWith(".d.ts")) {
			typeFiles.push(file);
		} else {
			if (!file.startsWith("test/")) {
				const expectedName = `${packageName}-tests.ts`;
				if (file !== expectedName && file !== expectedName + "x") {
					throw new Error(`In ${directory}: Expected file '${file}' to be named ${expectedName}`);
				}
			}
			testFiles.push(file);
		}
	}

	return { typeFiles, testFiles };
}

/** In addition to dependencies found oun source code, also get dependencies from tsconfig. */
async function calculateDependencies(packageName: string, directory: string, dependencies: Set<string>, oldMajorVersion: number | undefined
	): Promise<DependenciesRaw> {
	const tsconfig: { compilerOptions: ts.CompilerOptions } = await fsp.readJSON(joinPaths(directory, "tsconfig.json"));
	const { paths } = tsconfig.compilerOptions;

	for (const key in paths!) {
		if (key !== packageName && !dependencies.has(key)) {
			throw new Error(`In ${packageName}: path mapping for '${key}' is not used.`);
		}
	}

	if (oldMajorVersion !== undefined) {
		const selfPath: string[] | undefined = paths && paths[packageName];
		const version = selfPath === undefined ? undefined : parseDependencyVersionFromPath(packageName, packageName, selfPath);
		if (version !== oldMajorVersion) {
			console.log(version, oldMajorVersion);
			const correctPathMapping = `${packageName}/v${oldMajorVersion}`;
			throw new Error(`${packageName}: Must have a "paths" entry of "${packageName}": ${JSON.stringify([correctPathMapping])}`);
		}
	}

	return makeObject(dependencies, dependency => {
		const path = paths && paths[dependency];
		return path === undefined ? "*" : parseDependencyVersionFromPath(packageName, dependency, path);
	});
}

// e.g. parseDependencyVersionFromPath("../../foo/v0", "foo") should return "0"
function parseDependencyVersionFromPath(packageName: string, dependencyName: string, dependencyPaths: string[]): number {
	if (dependencyPaths.length !== 1) {
		throw new Error(`In ${packageName}: Path mapping for ${dependencyName} may only have 1 entry.`);
	}

	const dependencyPath = dependencyPaths[0];
	const versionString = withoutStart(dependencyPath, dependencyName + "/");
	const version = versionString === undefined ? undefined : parseMajorVersionFromDirectoryName(versionString);
	if (version === undefined) {
		throw new Error(`In ${packageName}, unexpected path mapping for ${dependencyName}: '${dependencyPath}'`);
	}
	return version;
}

function withoutStart(s: string, start: string): string | undefined {
	if (s.startsWith(start)) {
		return s.slice(start.length);
	}
	return undefined;
}

async function hash(directory: string, files: string[]): Promise<string> {
	const fileContents = await mapAsyncOrdered(files, async f => f + "**" + await readFile(directory, f));
	const allContent = fileContents.join("||");
	return computeHash(allContent);
}

export async function readFile(directory: string, fileName: string): Promise<string> {
	const full = joinPaths(directory, fileName);
	const text = await readFileText(full);
	if (text.charCodeAt(0) === 0xFEFF) {
		const commands = [
			"npm install -g strip-bom-cli",
			`strip-bom ${fileName} > fix`,
			`mv fix ${fileName}`
		];
		throw new Error(`File '${full}' has a BOM. Try using:\n${commands.join("\n")}`);
	}
	return text;
}

const unusedFilesName = "UNUSED_FILES.txt";

async function checkAllFilesUsed(directory: string, ls: string[], usedFiles: Set<string>): Promise<void> {
	const lsSet = new Set(ls);
	const unusedFiles = lsSet.delete(unusedFilesName)
		? new Set((await fsp.readFile(joinPaths(directory, unusedFilesName), "utf-8")).split(/\r?\n/g))
		: new Set<string>();
	await checkAllUsedRecur(directory, lsSet, usedFiles, unusedFiles);
}

async function checkAllUsedRecur(directory: string, ls: Iterable<string>, usedFiles: Set<string>, unusedFiles: Set<string>): Promise<void> {
	for (const lsEntry of ls) {
		if (usedFiles.has(lsEntry)) {
			continue;
		}
		if (unusedFiles.has(lsEntry)) {
			unusedFiles.delete(lsEntry);
			continue;
		}

		const stat = await fsp.stat(joinPaths(directory, lsEntry));
		if (stat.isDirectory()) {
			// We allow a "scripts" directory to be used for scripts.
			if (lsEntry === "node_modules" || lsEntry === "scripts") {
				continue;
			}

			const subdir = joinPaths(directory, lsEntry);
			const lssubdir = await fsp.readdir(subdir);
			if (lssubdir.length === 0) {
				throw new Error(`Empty directory ${subdir} (${join(usedFiles)})`);
			}

			function takeSubdirectoryOutOfSet(originalSet: Set<string>) {
				const subdirSet = new Set<string>();
				for (const file of originalSet) {
					const sub = withoutStart(file, lsEntry + "/");
					if (sub !== undefined) {
						originalSet.delete(file);
						subdirSet.add(sub);
					}
				}
				return subdirSet;
			}
			await checkAllUsedRecur(subdir, lssubdir, takeSubdirectoryOutOfSet(usedFiles), takeSubdirectoryOutOfSet(unusedFiles));
		} else {
			if (lsEntry.toLowerCase() !== "readme.md" && lsEntry !== "NOTICE" && lsEntry !== ".editorconfig") {
				throw new Error(`Directory ${directory} has unused file ${lsEntry}`);
			}
		}
	}

	for (const unusedFile of unusedFiles) {
		throw new Error(`In ${directory}: file ${unusedFile} listed in ${unusedFilesName} does not exist.`);
	}
}
