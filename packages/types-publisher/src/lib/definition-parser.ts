import { parseHeaderOrFail } from "definitelytyped-header-parser";
import { pathExists, readdir, readFileSync, readJSON } from "fs-extra";
import * as ts from "typescript";

import { isDirectory, readFile, readJson } from "../util/io";
import { Log, moveLogs, quietLogger } from "../util/logging";
import { computeHash, filter, hasWindowsSlashes, join, joinPaths, mapAsyncOrdered } from "../util/util";

import getModuleInfo, { getTestDependencies } from "./module-info";

import { DependenciesRaw, getLicenseFromPackageJson, PackageJsonDependency, PathMappingsRaw, TypingsDataRaw, TypingsVersionsRaw } from "./packages";

const dependenciesWhitelist = new Set(readFileSync(joinPaths(__dirname, "..", "..", "dependenciesWhitelist.txt"), "utf-8").split(/\r?\n/));

export interface TypingInfo { data: TypingsVersionsRaw; logs: Log; }
export async function getTypingInfo(packageName: string, typesPath: string): Promise<TypingInfo> {
	if (packageName !== packageName.toLowerCase()) {
		throw new Error(`Package name \`${packageName}\` should be strictly lowercase`);
	}
	const rootDirectory = joinPaths(typesPath, packageName);
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
		const files = await readdir(directory);
		const { data, logs } = await getTypingData(packageName, directory, files, majorVersion);
		log(`Parsing older version ${majorVersion}`);
		moveLogs(log, logs, msg => `    ${msg}`);

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
	const lsRootDirectory = await readdir(rootDirectory);
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
	// tslint:disable-next-line no-null-keyword
	return match === null ? undefined : Number(match[1]);
}

/**
 * @param packageName Name of the outermost directory; e.g. for "node/v4" this is just "node".
 * @param directory Full path to the directory for this package; e.g. "../DefinitelyTyped/foo/v3".
 * @param ls All file/directory names in `directory`.
 */
async function getTypingData(packageName: string, directory: string, ls: ReadonlyArray<string>, oldMajorVersion?: number
	): Promise<{ data: TypingsDataRaw, logs: Log }> {
	const [log, logResult] = quietLogger();

	log(`Reading contents of ${directory}`);

	// There is a *single* main file, containing metadata comments.
	// But there may be many entryFilenames, which are the starting points of inferring all files to be included.
	const mainFilename = "index.d.ts";

	const { contributors, libraryMajorVersion, libraryMinorVersion, typeScriptVersion, libraryName, projects } =
		parseHeaderOrFail(await readFileAndThrowOnBOM(directory, mainFilename));

	const tsconfig: TsConfig = await readJSON(joinPaths(directory, "tsconfig.json"));
	const { typeFiles, testFiles } = await entryFilesFromTsConfig(packageName, directory, tsconfig);
	const { dependencies: dependenciesWithDeclaredModules, globals, declaredModules, declFiles } =
		await getModuleInfo(packageName, directory, typeFiles);
	const declaredModulesSet = new Set(declaredModules);
	// Don't count an import of "x" as a dependency if we saw `declare module "x"` somewhere.
	const removeDeclaredModules = (modules: Iterable<string>): Iterable<string> => filter(modules, m => !declaredModulesSet.has(m));
	const dependenciesSet = new Set(removeDeclaredModules(dependenciesWithDeclaredModules));
	const testDependencies = Array.from(removeDeclaredModules(await getTestDependencies(packageName, directory, testFiles, dependenciesSet)));
	const { dependencies, pathMappings } = await calculateDependencies(packageName, tsconfig, dependenciesSet, oldMajorVersion);

	const packageJsonPath = joinPaths(directory, "package.json");
	const hasPackageJson = await pathExists(packageJsonPath);
	const packageJson = hasPackageJson ? await readJson(packageJsonPath) as { readonly license?: {} | null, readonly dependencies?: {} | null } : {};
	const license = getLicenseFromPackageJson(packageJson.license);
	const packageJsonDependencies = checkPackageJsonDependencies(packageJson.dependencies, packageJsonPath);

	const allContentHashFiles = hasPackageJson ? declFiles.concat(["package.json"]) : declFiles;

	const allFiles = new Set(allContentHashFiles.concat(testFiles, ["tsconfig.json", "tslint.json"]));
	await checkAllFilesUsed(directory, ls, allFiles);

	// Double-check that no windows "\\" broke in.
	for (const fileName of allContentHashFiles) {
		if (hasWindowsSlashes(fileName)) {
			throw new Error(`In ${packageName}: windows slash detected in ${fileName}`);
		}
	}

	const sourceRepoURL = "https://github.com/DefinitelyTyped/DefinitelyTyped";

	const data: TypingsDataRaw = {
		contributors,
		dependencies,
		testDependencies,
		pathMappings,
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
		testFiles,
		license,
		packageJsonDependencies,
		contentHash: await hash(directory, allContentHashFiles, tsconfig.compilerOptions.paths)
	};
	return { data, logs: logResult() };
}

function checkPackageJsonDependencies(dependencies: {} | null | undefined, path: string): ReadonlyArray<PackageJsonDependency> {
	if (dependencies === undefined) {
		return [];
	}
	if (dependencies === null || typeof dependencies !== "object") { // tslint:disable-line strict-type-predicates
		throw new Error(`${path} should contain "dependencies" or not exist.`);
	}

	const deps: PackageJsonDependency[] = [];

	for (const dependencyName in dependencies) {
		if (!dependenciesWhitelist.has(dependencyName)) {
			const msg = dependencyName.startsWith("@types/")
				? "Don't use a 'package.json' for @types dependencies."
				: `Dependency ${dependencyName} not in whitelist.
If you are depending on another \`@types\` package, do *not* add it to a \`package.json\`. Path mapping should make the import work.
If this is an external library that provides typings,  please make a pull request to types-publisher adding it to \`dependenciesWhitelist.txt\`.`;
			throw new Error(`In ${path}: ${msg}`);
		}

		const version = (dependencies as any)[dependencyName];
		if (typeof version !== "string") { // tslint:disable-line strict-type-predicates
			throw new Error(`In ${path}: Dependency version for ${dependencyName} should be a string.`);
		}
		deps.push({ name: dependencyName, version });
	}

	return deps;
}

async function entryFilesFromTsConfig(packageName: string, directory: string, tsconfig: TsConfig
	): Promise<{ typeFiles: string[], testFiles: string[] }> {
	const tsconfigPath = joinPaths(directory, "tsconfig.json");
	if (tsconfig.include) {
		throw new Error(`${tsconfigPath}: Don't use "include", must use "files"`);
	}

	const files = tsconfig.files;
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
				if (file !== expectedName && file !== `${expectedName}x`) {
					const message = file.endsWith(".ts") || file.endsWith(".tsx")
						? `Expected file '${file}' to be named ${expectedName}`
						: `Unexpected file extension for '${file}' -- expected '.ts' or '.tsx' (maybe this should not be in "files")`;
					throw new Error(`In ${directory}: ${message}`);
				}
			}
			testFiles.push(file);
		}
	}

	return { typeFiles, testFiles };
}

interface TsConfig {
	include?: ReadonlyArray<string>;
	files?: ReadonlyArray<string>;
	compilerOptions: ts.CompilerOptions;
}

/** In addition to dependencies found oun source code, also get dependencies from tsconfig. */
async function calculateDependencies(
	packageName: string,
	tsconfig: TsConfig,
	dependencyNames: ReadonlySet<string>,
	oldMajorVersion: number | undefined,
): Promise<{ dependencies: DependenciesRaw, pathMappings: PathMappingsRaw }> {
	const paths = tsconfig.compilerOptions && tsconfig.compilerOptions.paths || {};

	const dependencies: DependenciesRaw = {};
	const pathMappings: PathMappingsRaw = {};

	for (const dependencyName in paths) {
		// Might have a path mapping for "foo/*" to support subdirectories
		const rootDirectory = withoutEnd(dependencyName, "/*");
		if (rootDirectory !== undefined) {
			if (!(rootDirectory in paths)) {
				throw new Error(`In ${packageName}: found path mapping for ${dependencyName} but not for ${rootDirectory}`);
			}
			continue;
		}

		const pathMappingList = paths[dependencyName];
		if (pathMappingList.length !== 1) {
			throw new Error(`In ${packageName}: Path mapping for ${dependencyName} may only have 1 entry.`);
		}
		const pathMapping = pathMappingList[0];

		// Path mapping may be for "@foo/bar" -> "foo__bar". Based on `getPackageNameFromAtTypesDirectory` in TypeScript.
		const mangledScopedPackageSeparator = "__";
		if (pathMapping.indexOf(mangledScopedPackageSeparator) !== -1) {
			const expected = `@${pathMapping.replace(mangledScopedPackageSeparator, "/")}`;
			if (dependencyName !== expected) {
				throw new Error(`Expected directory ${pathMapping} to be the path mapping for ${dependencyName}`);
			}
			continue;
		}

		const version = parseDependencyVersionFromPath(dependencyName, dependencyName, pathMapping);
		if (dependencyName === packageName) {
			if (oldMajorVersion === undefined) {
				throw new Error(`In ${packageName}: Latest version of a package should not have a path mapping for itself.`);
			} else if (version !== oldMajorVersion) {
				const correctPathMapping = [`${dependencyName}/v${oldMajorVersion}`];
				throw new Error(`In ${packageName}: Must have a "paths" entry of "${dependencyName}": ${JSON.stringify(correctPathMapping)}`);
			}
		} else {
			if (dependencyNames.has(dependencyName)) {
				dependencies[dependencyName] = version;
			}
		}
		// Else, the path mapping may be necessary if it is for a dependency-of-a-dependency. We will check this in check-parse-results.
		pathMappings[dependencyName] = version;
	}

	if (oldMajorVersion !== undefined && !(paths && packageName in paths)) {
		throw new Error(`${packageName}: Older version ${oldMajorVersion} must have a path mapping for itself.`);
	}

	for (const dependency of dependencyNames) {
		if (!(dependency in dependencies)) {
			dependencies[dependency] = "*";
		}
	}

	return { dependencies, pathMappings };
}

// e.g. parseDependencyVersionFromPath("../../foo/v0", "foo") should return "0"
function parseDependencyVersionFromPath(packageName: string, dependencyName: string, dependencyPath: string): number {
	const versionString = withoutStart(dependencyPath, `${dependencyName}/`);
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

function withoutEnd(s: string, end: string): string | undefined {
	if (s.endsWith(end)) {
		return s.slice(0, s.length - end.length);
	}
	return undefined;
}

async function hash(directory: string, files: ReadonlyArray<string>, tsconfigPaths: ts.MapLike<ReadonlyArray<string>> | undefined): Promise<string> {
	const fileContents = await mapAsyncOrdered(files, async f => `${f}**${await readFileAndThrowOnBOM(directory, f)}`);
	let allContent = fileContents.join("||");
	if (tsconfigPaths) {
		allContent += JSON.stringify(tsconfigPaths);
	}
	return computeHash(allContent);
}

export async function readFileAndThrowOnBOM(directory: string, fileName: string): Promise<string> {
	const full = joinPaths(directory, fileName);
	const text = await readFile(full);
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

async function checkAllFilesUsed(directory: string, ls: ReadonlyArray<string>, usedFiles: Set<string>): Promise<void> {
	const lsSet = new Set(ls);
	const unusedFiles = lsSet.delete(unusedFilesName)
		? new Set((await readFile(joinPaths(directory, unusedFilesName))).split(/\r?\n/g))
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

		if (await isDirectory(joinPaths(directory, lsEntry))) {
			// We allow a "scripts" directory to be used for scripts.
			if (lsEntry === "node_modules" || lsEntry === "scripts") {
				continue;
			}

			const subdir = joinPaths(directory, lsEntry);
			const lssubdir = await readdir(subdir);
			if (lssubdir.length === 0) {
				throw new Error(`Empty directory ${subdir} (${join(usedFiles)})`);
			}

			function takeSubdirectoryOutOfSet(originalSet: Set<string>): Set<string> {
				const subdirSet = new Set<string>();
				for (const file of originalSet) {
					const sub = withoutStart(file, `${lsEntry}/`);
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
