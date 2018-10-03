import { parseHeaderOrFail } from "definitelytyped-header-parser";
import * as ts from "typescript";

import { FS } from "../get-definitely-typed";
import { Log, moveLogs, quietLogger } from "../util/logging";
import { computeHash, filter, hasWindowsSlashes, join, mapAsyncOrdered, withoutStart } from "../util/util";

import getModuleInfo, { getTestDependencies } from "./module-info";

import { DependenciesRaw, getLicenseFromPackageJson, PackageJsonDependency, PathMappingsRaw, TypingsDataRaw, TypingsVersionsRaw } from "./packages";
import { dependenciesWhitelist } from "./settings";

export interface TypingInfo { data: TypingsVersionsRaw; logs: Log; }

/** @param fs Rooted at the package's directory, e.g. `DefinitelyTyped/types/abs` */
export async function getTypingInfo(packageName: string, fs: FS): Promise<TypingInfo> {
	if (packageName !== packageName.toLowerCase()) {
		throw new Error(`Package name \`${packageName}\` should be strictly lowercase`);
	}
	const { rootDirectoryLs, olderVersionDirectories } = await getOlderVersions(fs);

	const { data: latestData, logs: latestLogs } = await getTypingData(packageName, rootDirectoryLs, fs);
	const latestVersion = latestData.libraryMajorVersion;

	const [log, logResult] = quietLogger();
	moveLogs(log, latestLogs);

	const older = await mapAsyncOrdered(olderVersionDirectories, async ({ directoryName, majorVersion }) => {
		if (majorVersion === latestVersion) {
			throw new Error(`The latest major version is ${latestVersion}, but a directory v${latestVersion} exists.`);
		}

		const ls = await fs.readdir(directoryName);
		const { data, logs } = await getTypingData(packageName, ls, fs.subDir(directoryName), majorVersion);
		log(`Parsing older version ${majorVersion}`);
		moveLogs(log, logs, msg => `    ${msg}`);

		if (data.libraryMajorVersion !== majorVersion) {
			throw new Error(
				`Directory ${directoryName} indicates major version ${majorVersion}, but header indicates major version ${data.libraryMajorVersion}`);
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

interface OlderVersionDirectory { readonly directoryName: string; readonly majorVersion: number; }
interface OlderVersions { readonly rootDirectoryLs: ReadonlyArray<string>; readonly olderVersionDirectories: ReadonlyArray<OlderVersionDirectory>; }
async function getOlderVersions(fs: FS): Promise<OlderVersions> {
	const lsRootDirectory = await fs.readdir();
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

interface TypingData {readonly data: TypingsDataRaw; readonly logs: Log; }
/**
 * @param packageName Name of the outermost directory; e.g. for "node/v4" this is just "node".
 * @param directory Full path to the directory for this package; e.g. "../DefinitelyTyped/foo/v3".
 * @param ls All file/directory names in `directory`.
 */
async function getTypingData(packageName: string, ls: ReadonlyArray<string>, fs: FS, oldMajorVersion?: number): Promise<TypingData> {
	const [log, logResult] = quietLogger();

	log(`Reading contents of ${packageName}`);

	// There is a *single* main file, containing metadata comments.
	// But there may be many entryFilenames, which are the starting points of inferring all files to be included.
	const mainFilename = "index.d.ts";

	const { contributors, libraryMajorVersion, libraryMinorVersion, typeScriptVersion, libraryName, projects } =
		parseHeaderOrFail(await readFileAndThrowOnBOM(mainFilename, fs));

	const tsconfig = await fs.readJson("tsconfig.json") as TsConfig; // tslint:disable-line await-promise (tslint bug)
	const { typeFiles, testFiles } = await entryFilesFromTsConfig(packageName, tsconfig, fs.debugPath());
	const { dependencies: dependenciesWithDeclaredModules, globals, declaredModules, declFiles } =
		await getModuleInfo(packageName, typeFiles, fs);
	const declaredModulesSet = new Set(declaredModules);
	// Don't count an import of "x" as a dependency if we saw `declare module "x"` somewhere.
	const removeDeclaredModules = (modules: Iterable<string>): Iterable<string> => filter(modules, m => !declaredModulesSet.has(m));
	const dependenciesSet = new Set(removeDeclaredModules(dependenciesWithDeclaredModules));
	const testDependencies = Array.from(removeDeclaredModules(await getTestDependencies(packageName, testFiles, dependenciesSet, fs)));
	const { dependencies, pathMappings } = await calculateDependencies(packageName, tsconfig, dependenciesSet, oldMajorVersion);

	const packageJsonPath = "package.json";
	const hasPackageJson = (await fs.readdir()).includes(packageJsonPath);
	// tslint:disable-next-line await-promise (tslint bug)
	const packageJson = hasPackageJson ? await fs.readJson(packageJsonPath) as { readonly license?: {} | null, readonly dependencies?: {} | null } : {};
	const license = getLicenseFromPackageJson(packageJson.license);
	const packageJsonDependencies = checkPackageJsonDependencies(packageJson.dependencies, packageJsonPath);

	const allContentHashFiles = hasPackageJson ? declFiles.concat(["package.json"]) : declFiles;

	const allFiles = new Set(allContentHashFiles.concat(testFiles, ["tsconfig.json", "tslint.json"]));
	await checkAllFilesUsed(ls, allFiles, fs);

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
		contentHash: await hash(allContentHashFiles, tsconfig.compilerOptions.paths, fs)
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

interface EntryFile { readonly typeFiles: ReadonlyArray<string>; readonly testFiles: ReadonlyArray<string>; }
async function entryFilesFromTsConfig(packageName: string, tsconfig: TsConfig, directoryPath: string): Promise<EntryFile> {
	const tsconfigPath = `${directoryPath}/tsconfig.json`;
	if (tsconfig.include) {
		throw new Error(`In tsconfig, don't use "include", must use "files"`);
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
					throw new Error(message);
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
		if (!(dependency in dependencies) && !nodeBuiltins.has(dependency)) {
			dependencies[dependency] = "*";
		}
	}

	return { dependencies, pathMappings };
}

const nodeBuiltins: ReadonlySet<string> = new Set([
	"assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto",
	"dgram", "dns", "domain", "events", "fs", "http", "http2", "https", "module", "net", "os",
	"path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "stream",
	"string_decoder", "timers", "tls", "tty", "url", "util", "v8", "vm", "zlib",
]);

// e.g. parseDependencyVersionFromPath("../../foo/v0", "foo") should return "0"
function parseDependencyVersionFromPath(packageName: string, dependencyName: string, dependencyPath: string): number {
	const versionString = withoutStart(dependencyPath, `${dependencyName}/`);
	const version = versionString === undefined ? undefined : parseMajorVersionFromDirectoryName(versionString);
	if (version === undefined) {
		throw new Error(`In ${packageName}, unexpected path mapping for ${dependencyName}: '${dependencyPath}'`);
	}
	return version;
}

function withoutEnd(s: string, end: string): string | undefined {
	if (s.endsWith(end)) {
		return s.slice(0, s.length - end.length);
	}
	return undefined;
}

async function hash(files: ReadonlyArray<string>, tsconfigPaths: ts.MapLike<ReadonlyArray<string>> | undefined, fs: FS): Promise<string> {
	const fileContents = await mapAsyncOrdered(files, async f => `${f}**${await readFileAndThrowOnBOM(f, fs)}`);
	let allContent = fileContents.join("||");
	if (tsconfigPaths) {
		allContent += JSON.stringify(tsconfigPaths);
	}
	return computeHash(allContent);
}

export async function readFileAndThrowOnBOM(fileName: string, fs: FS): Promise<string> {
	const text = await fs.readFile(fileName);
	if (text.charCodeAt(0) === 0xFEFF) {
		const commands = [
			"npm install -g strip-bom-cli",
			`strip-bom ${fileName} > fix`,
			`mv fix ${fileName}`
		];
		throw new Error(`File '${fileName}' has a BOM. Try using:\n${commands.join("\n")}`);
	}
	return text;
}

const unusedFilesName = "UNUSED_FILES.txt";

async function checkAllFilesUsed(ls: ReadonlyArray<string>, usedFiles: Set<string>, fs: FS): Promise<void> {
	const lsSet = new Set(ls);
	const unusedFiles = lsSet.delete(unusedFilesName)
		? new Set((await fs.readFile(unusedFilesName)).split(/\r?\n/g))
		: new Set<string>();
	await checkAllUsedRecur(lsSet, usedFiles, unusedFiles, fs);
}

async function checkAllUsedRecur(ls: Iterable<string>, usedFiles: Set<string>, unusedFiles: Set<string>, fs: FS): Promise<void> {
	for (const lsEntry of ls) {
		if (usedFiles.has(lsEntry)) {
			continue;
		}
		if (unusedFiles.has(lsEntry)) {
			unusedFiles.delete(lsEntry);
			continue;
		}

		if (await fs.isDirectory(lsEntry)) {
			const subdir = fs.subDir(lsEntry);
			// We allow a "scripts" directory to be used for scripts.
			if (lsEntry === "node_modules" || lsEntry === "scripts") {
				continue;
			}

			const lssubdir = await subdir.readdir();
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
			await checkAllUsedRecur(lssubdir, takeSubdirectoryOutOfSet(usedFiles), takeSubdirectoryOutOfSet(unusedFiles), subdir);
		} else {
			if (lsEntry.toLowerCase() !== "readme.md" && lsEntry !== "NOTICE" && lsEntry !== ".editorconfig") {
				throw new Error(`Unused file ${fs.debugPath()}/${lsEntry}`);
			}
		}
	}

	for (const unusedFile of unusedFiles) {
		throw new Error(`File ${fs.debugPath()}/${unusedFile} listed in ${unusedFilesName} does not exist.`);
	}
}
