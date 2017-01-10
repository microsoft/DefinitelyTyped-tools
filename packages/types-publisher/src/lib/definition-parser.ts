import assert = require("assert");
import * as ts from "typescript";
import * as fsp from "fs-promise";
import * as path from "path";

import { readFile as readFileText } from "../util/io";
import { Logger, Log, moveLogs, quietLogger } from "../util/logging";
import { isExternalModule } from "../util/ts";
import { computeHash, join, mapDefined, mapAsyncOrdered, normalizeSlashes, stripQuotes, sort } from "../util/util";

import { Options } from "./common";
import { DependenciesRaw, TypingsDataRaw, TypingsVersionsRaw, packageRootPath } from "./packages";
import { parseHeaderOrFail } from "./header";

enum DeclarationFlags {
	None = 0,
	Value = 1 << 0,
	Type = 1 << 1,
	Namespace = 1 << 2,
	Augmentation = 1 << 3
}

function getNamespaceFlags(ns: ts.ModuleDeclaration): DeclarationFlags {
	let result = DeclarationFlags.None;
	if (!ns.body) {
		throw new Error("@types should not use shorthand ambient modules");
	}
	if (ns.body.kind === ts.SyntaxKind.ModuleDeclaration) {
		return getNamespaceFlags(ns.body as ts.ModuleDeclaration);
	}
	(ns.body as ts.ModuleBlock).statements.forEach(child => {
		switch (child.kind) {
			case ts.SyntaxKind.VariableStatement:
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.EnumDeclaration:
				result |= DeclarationFlags.Value;
				break;

			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.TypeAliasDeclaration:
			case ts.SyntaxKind.ImportEqualsDeclaration:
				result |= DeclarationFlags.Type;
				break;

			case ts.SyntaxKind.ModuleDeclaration:
				result |= getNamespaceFlags(child as ts.ModuleDeclaration);
				break;

			default:
				console.log(`Forgot to implement ambient namespace statement ${ts.SyntaxKind[child.kind]}`);
		}
	});
	return result;
}

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
	const { dependencies, globalSymbols, declaredModules, declFiles } =
		await getModuleInfo(packageName, directory, typeFiles, log);

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
		globals: Object.keys(globalSymbols).filter(k => !!(globalSymbols[k] & DeclarationFlags.Value)).sort(),
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

/** Returns a map from filename (path relative to `directory`) to the SourceFile we parsed for it. */
async function allReferencedFiles(directory: string, entryFilenames: string[], log: Logger): Promise<Map<string, ts.SourceFile>> {
	const all = new Map<string, ts.SourceFile>();

	async function recur(referencedFrom: string, filename: string): Promise<void> {
		if (all.has(filename)) {
			return;
		}
		// Placeholder so no other thread will pick up this filename
		all.set(filename, undefined);

		log(`Parse ${filename}`);
		let content: string;
		try {
			content = await readFile(directory, filename);
		} catch (err) {
			console.error(`In ${directory}, ${referencedFrom} references ${filename}, which can't be read.`);
			throw err;
		}
		const src = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
		all.set(filename, src);

		const refs = referencedFiles(src, path.dirname(filename), directory);
		await Promise.all(refs.map(ref => recur(filename, normalizeSlashes(ref))));
	}

	await Promise.all(entryFilenames.map(filename => recur("", filename)));
	return all;
}

/**
 * @param subDirectory The specific directory within the DefinitelyTyped directory we are in.
 * For example, `directory` may be `react-router` and `subDirectory` may be `react-router/lib`.
 */
function referencedFiles(src: ts.SourceFile, subDirectory: string, directory: string): string[] {
	const out: string[] = [];

	for (const ref of src.referencedFiles) {
		// Any <reference path="foo"> is assumed to be local
		addReference(ref.fileName);
	}

	for (const ref of imports(src)) {
		if (ref.startsWith(".")) {
			addReference(`${ref}.d.ts`);
		}
	}

	return out;

	function addReference(ref: string): void {
		const full = path.normalize(path.join(subDirectory, ref));
		if (full.startsWith(".")) {
			throw new Error(
				`In ${directory} ${src.fileName}: Definitions must use global references, not local references. (Based on reference '${ref}')`);
		}
		out.push(full);
	}
}

/**
 * All strings referenced in `import` statements.
 * Does *not* include <reference> directives.
 */
function imports(src: ts.SourceFile): string[] {
	const out: string[] = [];
	findImports(src.statements);
	return out;

	function findImports(statements: ts.Statement[]) {
		for (const node of statements) {
			switch (node.kind) {
				case ts.SyntaxKind.ImportDeclaration:
				case ts.SyntaxKind.ExportDeclaration: {
					const decl = node as ts.ImportDeclaration | ts.ExportDeclaration;
					if (decl.moduleSpecifier && decl.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
						out.push(stripQuotes(decl.moduleSpecifier.getText()));
					}
					break;
				}

				case ts.SyntaxKind.ImportEqualsDeclaration: {
					const decl = node as ts.ImportEqualsDeclaration;
					if (decl.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
						out.push(parseRequire(decl.moduleReference));
					}
					break;
				}

				case ts.SyntaxKind.ModuleDeclaration: {
					const decl = node as ts.ModuleDeclaration;
					if (decl.name.kind === ts.SyntaxKind.StringLiteral) {
						findImports((decl.body as ts.ModuleBlock).statements);
					}
					break;
				}

				default:
			}
		}
	}

	function parseRequire(reference: ts.ExternalModuleReference): string {
		const expr = reference.expression;
		if (!expr || expr.kind !== ts.SyntaxKind.StringLiteral) {
			throw new Error(`Bad 'import =' reference: ${reference.getText()}`);
		}
		return (expr as ts.StringLiteral).text;
	}
}

async function getModuleInfo(packageName: string, directory: string, allEntryFilenames: string[], log: Logger): Promise<ModuleInfo> {
	let hasUmdDecl = false;
	let hasGlobalDeclarations = false;
	let ambientModuleCount = 0;

	const dependencies = new Set<string>();
	const declaredModules: string[] = [];

	let globalSymbols: GlobalSymbols = {};
	function recordSymbol(name: string, flags: DeclarationFlags): void {
		globalSymbols[name] = (globalSymbols[name] || DeclarationFlags.None) | flags;
	}

	const all = await allReferencedFiles(directory, allEntryFilenames, log);

	for (const src of all.values()) {
		const isExternal = isExternalModule(src);
		// A file is a proper module if it is an external module *and* it has at least one export.
		// A module with only imports is not a proper module; it likely just augments some other module.
		let hasAnyExport = false;

		for (const ref of imports(src)) {
			if (!ref.startsWith(".")) {
				const importedModule = rootName(ref);
				dependencies.add(importedModule);
				log(`Found import declaration from \`"${importedModule}"\``);
			}
		}

		src.typeReferenceDirectives.forEach(ref => dependencies.add(ref.fileName));

		for (const node of src.statements) {
			switch (node.kind) {
				case ts.SyntaxKind.NamespaceExportDeclaration:
					const globalName = (node as ts.NamespaceExportDeclaration).name.getText();
					log(`Found UMD module declaration for global \`${globalName}\``);
					// Don't set hasGlobalDeclarations = true even though we add a symbol here
					// since this is still a legal module-only declaration
					globalSymbols[globalName] = ts.SymbolFlags.Value;
					hasAnyExport = true;
					hasUmdDecl = true;
					break;

				case ts.SyntaxKind.ModuleDeclaration:
					if (isExternal) {
						log(`Found exported namespace \`${(node as ts.ModuleDeclaration).name.getText()}\``);
						hasAnyExport = true;
					} else {
						const nameKind = (node as ts.ModuleDeclaration).name.kind;
						if (nameKind === ts.SyntaxKind.StringLiteral) {
							// If we're in an external module, this is an augmentation, not a declaration.
							if (!isExternalModule(src)) {
								const name = stripQuotes((node as ts.ModuleDeclaration).name.getText());
								declaredModules.push(name);
								log(`Found ambient external module \`"${name}"\``);
								ambientModuleCount++;
							}
						} else {
							const moduleName = (node as ts.ModuleDeclaration).name.getText();
							log(`Found global namespace declaration \`${moduleName}\``);
							hasGlobalDeclarations = true;
							recordSymbol(moduleName, getNamespaceFlags(node as ts.ModuleDeclaration));
						}
					}
					break;

				case ts.SyntaxKind.VariableStatement:
					if (isExternal) {
						log("Found exported variables");
						hasAnyExport = true;
					} else {
						(node as ts.VariableStatement).declarationList.declarations.forEach(decl => {
							const declName = decl.name.getText();
							log(`Found global variable \`${declName}\``);
							recordSymbol(declName, DeclarationFlags.Value);
						});
						hasGlobalDeclarations = true;
					}
					break;

				case ts.SyntaxKind.InterfaceDeclaration:
				case ts.SyntaxKind.TypeAliasDeclaration:
				case ts.SyntaxKind.EnumDeclaration:
				case ts.SyntaxKind.ClassDeclaration:
				case ts.SyntaxKind.FunctionDeclaration:
					// If these nodes have an 'export' modifier, the file is an external module
					if (isExternal) {
						const declName = (node as ts.DeclarationStatement).name;
						if (declName) {
							log(`Found exported declaration "${declName.getText()}"`);
						}
						hasAnyExport = true;
					} else {
						const declName = ((node as ts.DeclarationStatement).name as ts.Identifier).getText();
						const isType = node.kind === ts.SyntaxKind.InterfaceDeclaration || node.kind === ts.SyntaxKind.TypeAliasDeclaration;
						log(`Found global ${isType ? "type" : "value"} declaration "${declName}"`);
						recordSymbol(declName, isType ? DeclarationFlags.Type : DeclarationFlags.Value);
						hasGlobalDeclarations = true;
					}
					break;

				case ts.SyntaxKind.ExportDeclaration:
				case ts.SyntaxKind.ExportAssignment:
					// These nodes always indicate an external module
					log(`Found export assignment or export declaration`);
					hasAnyExport = true;
					break;

				case ts.SyntaxKind.ImportEqualsDeclaration:
				case ts.SyntaxKind.ImportDeclaration:
					// Already handled these in `imports`
					break;

				default:
					throw new Error(`Bad node in ${path.join(directory, src.fileName)}: '${node.getText()}' is of kind ${ts.SyntaxKind[node.kind]}`);
			}
		}

		const isProperModule = isExternal && hasAnyExport;

		if (isProperModule) {
			declaredModules.push(properModuleName(packageName, src.fileName));
		}
	}

	// Some files may reference the main module, but don't include that as a real dependency.
	dependencies.delete(packageName);

	return {
		declFiles: sort(all.keys()),
		dependencies: await calculateDependencies(packageName, directory, dependencies),
		declaredModules, globalSymbols
	};
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

/** Given "foo/bar/baz", return "foo". */
function rootName(importText: string) {
	let slash = importText.indexOf("/");
	// Root of `@foo/bar/baz` is `@foo/bar`
	if (importText.startsWith("@")) {
		// Use second "/"
		slash = importText.indexOf("/", slash + 1);
	}
	return slash === -1 ? importText : importText.slice(0, slash);
}

/**
 * Given a file name, get the name of the module it declares.
 * `foo/index.d.ts` declares "foo", `foo/bar.d.ts` declares "foo/bar", "foo/bar/index.d.ts" declares "foo/bar"
 */
function properModuleName(folderName: string, fileName: string): string {
	const part = path.basename(fileName) === "index.d.ts" ? path.dirname(fileName) : withoutExtension(fileName, ".d.ts");
	return path.join(folderName, part);
}

function withoutExtension(str: string, ext: string): string {
	assert(str.endsWith(ext));
	return str.slice(0, str.length - ext.length);
}

interface GlobalSymbols {
	[name: string]: ts.SymbolFlags;
}
interface ModuleInfo {
	// Every declaration file used (starting from the entry point)
	declFiles: string[];
	dependencies: DependenciesRaw;
	// Anything from a `declare module "foo"`
	declaredModules: string[];
	// Every global symbol
	globalSymbols: GlobalSymbols;
}

async function hash(directory: string, files: string[]): Promise<string> {
	const fileContents = await mapAsyncOrdered(files, async f => f + "**" + await readFile(directory, f));
	const allContent = fileContents.join("||");
	return computeHash(allContent);
}

async function readFile(directory: string, fileName: string): Promise<string> {
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
