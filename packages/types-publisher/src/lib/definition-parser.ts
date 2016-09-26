import * as ts from "typescript";
import * as fsp from "fs-promise";
import * as path from "path";

import { RejectionReason, TypingsData, computeHash, definitelyTypedPath, settings } from "./common";
import { Logger, LoggerWithErrors, LogWithErrors, quietLoggerWithErrors } from "./logging";
import { mapAsyncOrdered, normalizeSlashes, readdirRecursive, readFile as readFileText, stripQuotes } from "./util";

export interface TypingParseFailResult {
	kind: "fail";
	rejectionReason: RejectionReason;
	logs: LogWithErrors;
}

export interface TypingParseSucceedResult {
	kind: "success";
	data: TypingsData;
	logs: LogWithErrors;
}

enum DefinitionFileKind {
	// Dunno
	Unknown,
	// UMD module file
	UMD,
	// File has global variables or interfaces, but not any external modules
	Global,
	// File has top-level export declarations
	ProperModule,
	// File has a single declare module "foo" but no global interfaces or variables
	DeclareModule,
	// Some combination of Global and DeclareModule
	Mixed,
	// More than one 'declare module "foo"'
	MultipleModules,
	// Augments an external module
	ModuleAugmentation,
	// Old-style UMD
	OldUMD
}

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

interface Metadata {
	authors: string;
	libraryMajorVersion: string;
	libraryMinorVersion: string;
	libraryName: string;
	projectName: string;
}

function parseMetadata(mainFileContent: string): Metadata {
	function regexMatch(rx: RegExp, defaultValue: string): string {
		const match = rx.exec(mainFileContent);
		return match ? match[1] : defaultValue;
	}

	const authors = regexMatch(/^\/\/ Definitions by: (.+)$/m, "Unknown");
	const libraryMajorVersion = regexMatch(/^\/\/ Type definitions for [^\n]+ v?(\d+)/m, "0");
	const libraryMinorVersion = regexMatch(/^\/\/ Type definitions for [^\n]+ v?\d+\.(\d+)/m, "0");
	const libraryName = regexMatch(/^\/\/ Type definitions for (.+)$/m, "Unknown").trim();
	const projectName = regexMatch(/^\/\/ Project: (.+)$/m, "");

	return { authors, libraryMajorVersion, libraryMinorVersion, libraryName, projectName };
}

async function moduleInfoAndFileKind(directory: string, folderName: string, allEntryFilenames: string[], log: LoggerWithErrors): Promise<ModuleInfo & { fileKind: DefinitionFileKind }> {
	const mi = await getModuleInfo(directory, folderName, allEntryFilenames, log.info);
	const fileKind = getFileKind(mi, log.info);

	if (mi.declaredModules.length === 1 && fileKind !== DefinitionFileKind.ModuleAugmentation && mi.declaredModules[0].toLowerCase() !== folderName) {
		log.error(`Declared module \`${mi.declaredModules[0]}\` is in folder with incorrect name \`${folderName}\``);
	}

	if (mi.declaredModules.length === 0 && fileKind === DefinitionFileKind.ProperModule) {
		mi.declaredModules.push(folderName);
	}

	return Object.assign({fileKind}, mi);
}

export async function getTypingInfo(folderName: string): Promise<TypingParseFailResult | TypingParseSucceedResult> {
	const [log, logResult] = quietLoggerWithErrors();
	const directory = definitelyTypedPath(folderName);
	if (folderName !== folderName.toLowerCase()) {
		throw new Error(`Package name \`${folderName}\` should be strictly lowercase`);
	}

	log.info(`Reading contents of ${directory}`);

	// There is a *single* main file, containing metadata comments.
	// But there may be many entryFilenames, which are the starting points of inferring all files to be included.
	const mainFileResult = await mainFile(directory, folderName, log.info);
	if (mainFileResult.kind === "failure") {
		log.info(mainFileResult.message);
		log.error(mainFileResult.message);
		return { kind: "fail", logs: logResult(), rejectionReason: RejectionReason.TooManyFiles };
	}
	const mainFilename = mainFileResult.filename;
	const mainFileContent = await readFile(directory, mainFilename);

	const { authors, libraryMajorVersion, libraryMinorVersion, libraryName, projectName } = parseMetadata(mainFileContent);

	const allEntryFilenames = await entryFilesFromTsConfig(directory, log.info) || [mainFilename];
	const { referencedLibraries, moduleDependencies, globalSymbols, declaredModules, declFiles, fileKind } = await moduleInfoAndFileKind(directory, folderName, allEntryFilenames, log);

	const hasPackageJson = await fsp.exists(path.join(directory, "package.json"));
	const allFiles = hasPackageJson ? declFiles.concat(["package.json"]) : declFiles;

	const sourceRepoURL = "https://www.github.com/DefinitelyTyped/DefinitelyTyped";
	return {
		kind: "success",
		logs: logResult(),
		data: {
			authors,
			definitionFilename: mainFilename,
			libraryDependencies: referencedLibraries,
			moduleDependencies,
			libraryMajorVersion,
			libraryMinorVersion,
			libraryName,
			typingsPackageName: folderName,
			projectName,
			sourceRepoURL,
			sourceBranch: settings.sourceBranch,
			kind: DefinitionFileKind[fileKind],
			globals: Object.keys(globalSymbols).filter(k => !!(globalSymbols[k] & DeclarationFlags.Value)).sort(),
			declaredModules,
			root: path.resolve(directory),
			files: declFiles,
			hasPackageJson,
			contentHash: await hash(directory, allFiles)
		}
	};
}

interface MainFileSuccess {
	kind: "success";
	filename: string;
}
interface MainFileFailure {
	kind: "failure";
	message: string;
}
async function mainFile(directory: string, folderName: string, log: Logger): Promise<MainFileSuccess | MainFileFailure> {
	// otherwise, load all files from the directory
	const declFiles = await readdirRecursive(directory, (file, stats) =>
			// Only include type declaration files.
		stats.isDirectory() || file.endsWith(".d.ts"));
	declFiles.sort();

	log(`Found ${declFiles.length} '.d.ts' files in directory (${declFiles.join(", ")})`);

	if (declFiles.length === 1) {
		return { kind: "success", filename: declFiles[0] };
	} else {
		// You can have [foldername].d.ts, or index.d.ts to rescue yourself from this situation
		const candidates = [folderName + ".d.ts", "index.d.ts"];
		const existingCandidates = candidates.filter(c => declFiles.includes(c));
		if (existingCandidates.length > 1) {
			throw new Error(`Conflicting main files: ${existingCandidates}`);
		} else if (!existingCandidates.length) {
			return {
				kind: "failure",
				message: "Exiting, found either zero or more than one .d.ts file and none of " + candidates.map(c => "`" + c + "`").join(" or ")
			};
		} else {
			return { kind: "success", filename: existingCandidates[0] };
		}
	}
}

async function entryFilesFromTsConfig(directory: string, log: Logger): Promise<string[] | undefined> {
	// If there is a tsconfig.json with a "files" property use this as the entry point
	if (await fsp.exists(path.join(directory, "tsconfig.json"))) {
		const files: string[] = JSON.parse(await readFile(directory, "tsconfig.json")).files;
		if (files) {
			const filenames = files.filter(file => file.endsWith(".d.ts"));
			log(`Found ${filenames.length} '.d.ts' files listed in tsconfig.json (${filenames.join(", ")})`);
			return filenames;
		}
	}
	return undefined;
}

// See GH#68 for why we don't just include every file
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
			throw new Error(`In ${directory}, ${referencedFrom} references ${filename}, which does not exist.`);
		}
		const src = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
		all.set(filename, src);

		const refs = referencedFiles(src, path.dirname(filename));
		await Promise.all(refs.map(ref => recur(filename, ref)));
	}

	await Promise.all(entryFilenames.map(filename => recur("", filename)));
	return all;
}

/**
 * @param subDirectory The specific directory within the DefinitelyTyped directory we are in.
 * For example, `directory` may be `react-router` and `subDirectory` may be `react-router/lib`.
 */
function referencedFiles(src: ts.SourceFile, subDirectory: string): string[] {
	const out: string[] = [];

	for (const ref of src.referencedFiles) {
		// Any <reference path="foo"> is assumed to be local
		maybeAdd(ref.fileName);
	}

	for (const ref of imports(src)) {
		if (ref.startsWith(".")) {
			maybeAdd(`${ref}.d.ts`);
		}
	}

	return out;

	// GH#69: We should just forbid all non-global references to the outside.
	function maybeAdd(ref: string): void {
		const full = path.normalize(path.join(subDirectory, ref));
		// If the *normalized* path starts with "..", then it reaches outside of srcDirectory.
		if (!full.startsWith("..")) {
			out.push(normalizeSlashes(full));
		}
	}
}

/**
 * All strings referenced in `import` statements.
 * Does *not* include <reference> directives.
 */
function imports(src: ts.SourceFile): string[] {
	const out: string[] = [];

	for (const node of src.statements) {
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
					out.push(parseRequire(decl.moduleReference.getText()));
				}
				break;
			}

			default:
		}
	}

	return out;

	function parseRequire(text: string): string {
		const match = /require\(["'](.*)["']\)/.exec(text);
		if (match === null) {
			throw new Error(`Failed to parse import = declaration "${text}"`);
		}
		return match[1];
	}
}

async function getModuleInfo(directory: string, folderName: string, allEntryFilenames: string[], log: Logger): Promise<ModuleInfo> {
	let hasUmdDecl = false;
	let isProperModule = false;
	let hasGlobalDeclarations = false;
	let ambientModuleCount = 0;

	const moduleDependencies = new Set<string>();
	const referencedLibraries = new Set<string>();
	const declaredModules: string[] = [];

	let globalSymbols: GlobalSymbols = {};
	function recordSymbol(name: string, flags: DeclarationFlags) {
		globalSymbols[name] = (globalSymbols[name] || DeclarationFlags.None) | flags;
	}

	const all = await allReferencedFiles(directory, allEntryFilenames, log);

	for (const src of all.values()) {
		for (const ref of imports(src)) {
			if (!ref.startsWith(".")) {
				moduleDependencies.add(ref);
				log(`Found import declaration from \`"${ref}"\``);
				isProperModule = true;
			}
		}

		src.typeReferenceDirectives.forEach(ref => referencedLibraries.add(ref.fileName));

		for (const node of src.statements) {
			switch (node.kind) {
				case ts.SyntaxKind.NamespaceExportDeclaration:
					const globalName = (node as ts.NamespaceExportDeclaration).name.getText();
					log(`Found UMD module declaration for global \`${globalName}\``);
					// Don't set hasGlobalDeclarations = true even though we add a symbol here
					// since this is still a legal module-only declaration
					globalSymbols[globalName] = ts.SymbolFlags.Value;
					isProperModule = true;
					hasUmdDecl = true;
					break;

				case ts.SyntaxKind.ModuleDeclaration:
					if (node.flags & ts.NodeFlags.Export) {
						log(`Found exported namespace \`${(node as ts.ModuleDeclaration).name.getText()}\``);
						isProperModule = true;
					} else {
						const nameKind = (node as ts.ModuleDeclaration).name.kind;
						if (nameKind === ts.SyntaxKind.StringLiteral) {
							const name = stripQuotes((node as ts.ModuleDeclaration).name.getText());
							declaredModules.push(name);
							log(`Found ambient external module \`"${name}"\``);
							ambientModuleCount++;
						} else {
							const moduleName = (node as ts.ModuleDeclaration).name.getText();
							log(`Found global namespace declaration \`${moduleName}\``);
							hasGlobalDeclarations = true;
							recordSymbol(moduleName, getNamespaceFlags(node as ts.ModuleDeclaration));
						}
					}
					break;

				case ts.SyntaxKind.VariableStatement:
					if (node.flags & ts.NodeFlags.Export) {
						log("Found exported variables");
						isProperModule = true;
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
					if (node.flags & ts.NodeFlags.Export) {
						const declName = (node as ts.DeclarationStatement).name;
						if (declName) {
							log(`Found exported declaration "${declName.getText()}"`);
						}
						isProperModule = true;
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
					isProperModule = true;
					break;

				case ts.SyntaxKind.ImportEqualsDeclaration:
				case ts.SyntaxKind.ImportDeclaration:
					// Already handled these in `imports`
					break;

				default:
					throw new Error(`Bad node in ${path.join(directory, src.fileName)}: ts.SyntaxKind[node.kind])`);
			}
		}
	}

	// Some files may reference the main module, but don't include that as a real dependency.
	referencedLibraries.delete(folderName);
	moduleDependencies.delete(folderName);

	return {
		declFiles: arrayOf(all.keys()),
		referencedLibraries: arrayOf(referencedLibraries),
		moduleDependencies: arrayOf(moduleDependencies),
		hasUmdDecl, isProperModule, hasGlobalDeclarations, ambientModuleCount, declaredModules, globalSymbols
	};

	function arrayOf(strings: Iterable<string>): string[] {
		return Array.from(strings).sort();
	}
}

interface GlobalSymbols {
	[name: string]: ts.SymbolFlags;
}
interface ModuleInfo {
	hasUmdDecl: boolean;
	isProperModule: boolean;
	hasGlobalDeclarations: boolean;
	ambientModuleCount: number;

	// Every declaration file used (starting from the entry point)
	declFiles: string[];

	// Anything from an `import ... from "foo"`
	moduleDependencies: string[];
	// Anything from a `<reference types="foo">
	referencedLibraries: string[];
	// Anything from a `declare module "foo"`
	declaredModules: string[];
	// Every global symbol
	globalSymbols: GlobalSymbols;
}

function isNewGlobal(name: string): boolean {
	// This is not a new global if it simply augments an existing one.
	const augmentedGlobals = ["Array", "Function", "String", "Number", "Window", "Date", "StringConstructor", "NumberConstructor", "Math", "HTMLElement"];
	return !augmentedGlobals.includes(name);
}

function getFileKind(mi: ModuleInfo, log: Logger): DefinitionFileKind {
	const globals = Object.keys(mi.globalSymbols).filter(isNewGlobal);
	if (mi.isProperModule) {
		if (mi.hasUmdDecl) {
			log(`UMD module declaration detected`);
			return DefinitionFileKind.UMD;
		} else {
			if (mi.ambientModuleCount > 0) {
				log(`At least one import declaration and an ambient module declaration, this is a ModuleAugmentation file`);
				return DefinitionFileKind.ModuleAugmentation;
			} else {
				log(`At least one export declaration, this is a ProperModule file`);
				return DefinitionFileKind.ProperModule;
			}
		}
	} else {
		if (mi.hasGlobalDeclarations) {
			if (mi.ambientModuleCount === 1) {
				if (globals.length === 1) {
					log(`One global declaration and one ambient module declaration, this is an OldUMD file`);
					return DefinitionFileKind.OldUMD;
				} else {
					log(`${globals.length} global declarations and one ambient module declaration, this is a Mixed file`);
					return DefinitionFileKind.Mixed;
				}
			} else if (mi.ambientModuleCount > 1) {
				log(`Global declarations and multiple ambient module declaration, this is a MultipleModules file`);
				return DefinitionFileKind.MultipleModules;
			} else {
				log(`Global declarations and no ambient module declaration, this is a Global file`);
				return DefinitionFileKind.Global;
			}
		} else {
			if (mi.ambientModuleCount === 1) {
				log(`Exactly one ambient module declaration, this is a DeclareModule file`);
				return DefinitionFileKind.DeclareModule;
			} else if (mi.ambientModuleCount > 1) {
				log(`Multiple ambient module declaration, this is a MultipleModules file`);
				return DefinitionFileKind.MultipleModules;
			} else {
				return DefinitionFileKind.Unknown;
			}
		}
	}
}

async function hash(directory: string, files: string[]): Promise<string> {
	const fileContents = await mapAsyncOrdered(files, async f => f + "**" + await readFile(directory, f));
	const allContent = fileContents.join("||");
	return computeHash(allContent);
}

async function readFile(directory: string, fileName: string): Promise<string> {
	const result = await readFileText(path.join(directory, fileName));
	// Skip BOM
	return (result.charCodeAt(0) === 0xFEFF) ? result.substr(1) : result;
}
