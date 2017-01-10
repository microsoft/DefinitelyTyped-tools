import * as fsp from "fs-promise";
import * as path from "path";

import { readFile as readFileText } from "../util/io";
import { Log, moveLogs, quietLogger } from "../util/logging";
import { computeHash, join, mapDefined, mapAsyncOrdered } from "../util/util";

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

		const directory = path.join(rootDirectory, directoryName);
		const files = await fsp.readdir(directory);
		const { data, logs } = await getTypingData(packageName, directory, files);
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
async function getTypingData(packageName: string, directory: string, ls: string[]): Promise<{ data: TypingsDataRaw, logs: Log }> {
	const [log, logResult] = quietLogger();

	log(`Reading contents of ${directory}`);

	// There is a *single* main file, containing metadata comments.
	// But there may be many entryFilenames, which are the starting points of inferring all files to be included.
	const mainFilename = "index.d.ts";

	const { authors, libraryMajorVersion, libraryMinorVersion, typeScriptVersion, libraryName, projects } =
		parseHeaderOrFail(await readFile(directory, mainFilename), packageName);

	const { typeFiles, testFiles } = await entryFilesFromTsConfig(packageName, directory);
	const { dependencies: dependenciesSet, globals, declaredModules, declFiles } = await getModuleInfo(packageName, directory, typeFiles, log);
	const dependencies = await calculateDependencies(packageName, directory, dependenciesSet);

	const hasPackageJson = await fsp.exists(path.join(directory, "package.json"));
	const allContentHashFiles = hasPackageJson ? declFiles.concat(["package.json"]) : declFiles;

	const allFiles = new Set(allContentHashFiles.concat(testFiles, ["tsconfig.json", "tslint.json"]));
	await checkAllFilesUsed(directory, ls, allFiles);

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
	const tsconfigPath = path.join(directory, "tsconfig.json");
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
async function calculateDependencies(packageName: string, directory: string, dependencies: Set<string>): Promise<DependenciesRaw> {
	const tsconfig = await fsp.readJSON(path.join(directory, "tsconfig.json"));
	const res: DependenciesRaw = {};

	const { paths } = tsconfig;
	for (const key in paths) {
		if (key !== packageName && !dependencies.has(key)) {
			throw new Error(`In ${packageName}: path mapping for '${key}' is not used.`);
		}
	}

	for (const dependency of dependencies) {
		const path = paths && paths[dependency];
		const version = path === undefined ? "*" : parseDependencyVersionFromPath(packageName, dependency, paths[dependency]);
		res[dependency] = version;
	}

	return res;
}

// e.g. parseDependencyVersionFromPath("../../foo/v0", "foo") should return "0"
function parseDependencyVersionFromPath(packageName: string, dependencyName: string, dependencyPath: string): number {
	let short = dependencyPath;
	for (let x = withoutStart(short, "../"); x !== undefined; x = withoutStart(short, "../")) {
		short = x;
	}

	const versionString = withoutStart(short, dependencyName + "/");
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
	const full = path.join(directory, fileName);
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

async function checkAllFilesUsed(directory: string, ls: string[], usedFiles: Set<string>): Promise<void> {
	const unusedFilesName = "UNUSED_FILES.txt";
	if (ls.includes(unusedFilesName)) {
		const lsMinusUnusedFiles = new Set(ls);
		lsMinusUnusedFiles.delete(unusedFilesName);
		const unusedFiles = (await fsp.readFile(path.join(directory, unusedFilesName), "utf-8")).split(/\r?\n/g);
		for (const unusedFile of unusedFiles) {
			if (!lsMinusUnusedFiles.delete(unusedFile)) {
				throw new Error(`In ${directory}: file ${unusedFile} listed in ${unusedFilesName} does not exist.`);
			}
		}
		ls = Array.from(lsMinusUnusedFiles);
	}

	for (const lsEntry of ls) {
		if (usedFiles.has(lsEntry)) {
			continue;
		}

		const stat = await fsp.stat(path.join(directory, lsEntry));
		if (stat.isDirectory()) {
			// We allow a "scripts" directory to be used for scripts.
			if (lsEntry === "node_modules" || lsEntry === "scripts") {
				continue;
			}

			const subdir = path.join(directory, lsEntry);
			const lssubdir = await fsp.readdir(subdir);
			if (lssubdir.length === 0) {
				throw new Error(`Empty directory ${subdir} (${join(usedFiles)})`);
			}
			const usedInSubdir = mapDefined(usedFiles, u => withoutStart(u, lsEntry + "/"));
			await checkAllFilesUsed(subdir, lssubdir, new Set(usedInSubdir));
		} else {
			if (lsEntry.toLowerCase() !== "readme.md" && lsEntry !== "NOTICE" && lsEntry !== ".editorconfig") {
				throw new Error(`Directory ${directory} has unused file ${lsEntry}`);
			}
		}
	}
}
