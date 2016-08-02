import * as ts from "typescript";
import * as fsp from "fs-promise";
import * as path from "path";

import { RejectionReason, TypingParseSucceedResult, TypingParseFailResult, computeHash, definitelyTypedPath, settings } from "./common";
import { mapAsyncOrdered, readdirRecursive, readFile as readFileText, stripQuotes } from "./util";

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

export async function getTypingInfo(folderName: string): Promise<TypingParseFailResult | TypingParseSucceedResult> {
	const log: string[] = [];
	const warnings: string[] = [];
	const directory = definitelyTypedPath(folderName);

	log.push(`Reading contents of ${directory}`);

	const entryPointResult = await entryPoint(directory, folderName, log);
	if (entryPointResult.kind === "failure") {
		log.push(entryPointResult.message);
		warnings.push(entryPointResult.message);
		return { log, warnings, rejectionReason: RejectionReason.TooManyFiles };
	}
	const entryPointFilename = entryPointResult.filename;
	const entryPointContent = await readFile(directory, entryPointFilename);

	const mi = await getModuleInfo(directory, entryPointFilename, log, warnings);
	let fileKind = getFileKind(mi, log);

	if (mi.declaredModules.length === 1 && fileKind !== DefinitionFileKind.ModuleAugmentation && mi.declaredModules[0].toLowerCase() !== folderName.toLowerCase()) {
		warnings.push(`Declared module \`${mi.declaredModules[0]}\` is in folder with incorrect name \`${folderName}\``);
	}

	if (mi.declaredModules.length === 0 && fileKind === DefinitionFileKind.ProperModule) {
		mi.declaredModules.push(folderName);
	}

	function regexMatch(rx: RegExp, defaultValue: string): string {
		const match = rx.exec(entryPointContent);
		return match ? match[1] : defaultValue;
	}

	const authors = regexMatch(/^\/\/ Definitions by: (.+)$/m, "Unknown");
	const libraryMajorVersion = regexMatch(/^\/\/ Type definitions for [^\d\n]+ v?(\d+)/m, "0");
	const libraryMinorVersion = regexMatch(/^\/\/ Type definitions for [^\d\n]+ v?\d+\.(\d+)/m, "0");
	const libraryName = regexMatch(/^\/\/ Type definitions for (.+)$/m, "Unknown").trim();
	const projectName = regexMatch(/^\/\/ Project: (.+)$/m, "");
	const packageName = path.basename(directory);
	const sourceRepoURL = "https://www.github.com/DefinitelyTyped/DefinitelyTyped";

	if (packageName !== packageName.toLowerCase()) {
		warnings.push(`Package name \`${packageName}\` should be strictly lowercase`);
	}

	if (mi.referencedLibraries.concat(mi.moduleDependencies).some(s => s === libraryName)) {
		throw new Error(`Package references itself: ${libraryName}`);
	}

	const hasPackageJson = await fsp.exists(path.join(directory, "package.json"));
	const allFiles = hasPackageJson ? mi.declFiles.concat(["package.json"]) : mi.declFiles;

	return {
		log,
		warnings,
		data: {
			authors,
			definitionFilename: entryPointFilename,
			libraryDependencies: mi.referencedLibraries,
			moduleDependencies: mi.moduleDependencies,
			libraryMajorVersion,
			libraryMinorVersion,
			libraryName,
			typingsPackageName: folderName.toLowerCase(),
			projectName,
			sourceRepoURL,
			sourceBranch: settings.sourceBranch,
			kind: DefinitionFileKind[fileKind],
			globals: Object.keys(mi.globalSymbols).filter(k => !!(mi.globalSymbols[k] & DeclarationFlags.Value)).sort(),
			declaredModules: mi.declaredModules,
			root: path.resolve(directory),
			files: mi.declFiles,
			hasPackageJson,
			contentHash: await hash(directory, allFiles)
		}
	};
}

interface EntryPointSuccess {
	kind: "success";
	filename: string;
}
interface EntryPointFailure {
	kind: "failure";
	message: string;
}
async function entryPoint(directory: string, folderName: string, log: string[]): Promise<EntryPointSuccess | EntryPointFailure> {
	const declFiles = await readdirRecursive(directory, (file, stats) =>
		// Only include type declaration files.
		stats.isDirectory() || file.endsWith(".d.ts"));
	declFiles.sort();

	log.push(`Found ${declFiles.length} '.d.ts' files (${declFiles.join(", ")})`);

	if (declFiles.length === 1) {
		return { kind: "success", filename: declFiles[0] };
	} else {
		// You can have [foldername].d.ts, or index.d.ts to rescue yourself from this situation
		const candidates = [folderName + ".d.ts", "index.d.ts"];
		const filename = candidates.find(c => declFiles.includes(c));
		if (filename === undefined) {
			return {
				kind: "failure",
				message: "Exiting, found either zero or more than one .d.ts file and none of " + candidates.map(c => "`" + c + "`").join(" or ")
			};
		} else {
			log.push(`Used ${filename} as entry point`);
			return { kind: "success", filename };
		}
	}
}

// See GH#68 for why we don't just include every file
/** Returns a map from filename (path relative to `directory`) to the SourceFile we parsed for it. */
async function allReferencedFiles(directory: string, entryPointFilename: string, log: string[]): Promise<Map<string, ts.SourceFile>> {
	const all = new Map<string, ts.SourceFile>();

	async function recur(referencedFrom: string, filename: string): Promise<void> {
		if (all.has(filename)) {
			return;
		}

		log.push(`Parse ${filename}`);
		let content: string;
		try {
			content = await readFile(directory, filename);
		} catch (err) {
			throw new Error(`In ${directory}, ${referencedFrom} references ${filename}, which does not exist.`);
		}
		const src = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
		all.set(filename, src);

		const refs = referencedFiles(src, directory, path.dirname(filename));
		await Promise.all(refs.map(ref => recur(filename, ref)));
	}

	await recur("", entryPointFilename);
	return all;
}

/**
 * @param subDirectory The specific directory within the DefinitelyTyped directory we are in.
 * For example, `directory` may be `react-router` and `subDirectory` may be `react-router/lib`.
 */
function referencedFiles(src: ts.SourceFile, directory: string, subDirectory: string): string[] {
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
			out.push(full);
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
			case ts.SyntaxKind.ImportDeclaration: {
				const decl = node as ts.ImportDeclaration;
				if (decl.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
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

async function getModuleInfo(directory: string, entryPointFilename: string, log: string[], warnings: string[]): Promise<ModuleInfo> {
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

	const all = await allReferencedFiles(directory, entryPointFilename, log);

	for (const src of all.values()) {
		for (const ref of imports(src)) {
			if (!ref.startsWith(".")) {
				moduleDependencies.add(ref);
				log.push(`Found import declaration from \`"${ref}"\``);
				isProperModule = true;
			}
		}

		src.typeReferenceDirectives.forEach(ref => referencedLibraries.add(ref.fileName));

		for (const node of src.statements) {
			switch (node.kind) {
				case ts.SyntaxKind.NamespaceExportDeclaration:
					const globalName = (node as ts.NamespaceExportDeclaration).name.getText();
					log.push(`Found UMD module declaration for global \`${globalName}\``);
					// Don't set hasGlobalDeclarations = true even though we add a symbol here
					// since this is still a legal module-only declaration
					globalSymbols[globalName] = ts.SymbolFlags.Value;
					isProperModule = true;
					hasUmdDecl = true;
					break;

				case ts.SyntaxKind.ModuleDeclaration:
					if (node.flags & ts.NodeFlags.Export) {
						log.push(`Found exported namespace \`${(node as ts.ModuleDeclaration).name.getText()}\``);
						isProperModule = true;
					} else {
						const nameKind = (node as ts.ModuleDeclaration).name.kind;
						if (nameKind === ts.SyntaxKind.StringLiteral) {
							const name = stripQuotes((node as ts.ModuleDeclaration).name.getText());
							declaredModules.push(name);
							log.push(`Found ambient external module \`"${name}"\``);
							ambientModuleCount++;
						} else {
							const moduleName = (node as ts.ModuleDeclaration).name.getText();
							log.push(`Found global namespace declaration \`${moduleName}\``);
							hasGlobalDeclarations = true;
							recordSymbol(moduleName, getNamespaceFlags(node as ts.ModuleDeclaration));
						}
					}
					break;

				case ts.SyntaxKind.VariableStatement:
					if (node.flags & ts.NodeFlags.Export) {
						log.push("Found exported variables");
						isProperModule = true;
					} else {
						(node as ts.VariableStatement).declarationList.declarations.forEach(decl => {
							const declName = decl.name.getText();
							log.push(`Found global variable \`${declName}\``);
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
							log.push(`Found exported declaration "${declName.getText()}"`);
						}
						isProperModule = true;
					} else {
						const declName = (node as ts.DeclarationStatement).name.getText();
						const isType = node.kind === ts.SyntaxKind.InterfaceDeclaration || node.kind === ts.SyntaxKind.TypeAliasDeclaration;
						log.push(`Found global ${isType ? "type" : "value"} declaration "${declName}"`);
						recordSymbol(declName, isType ? DeclarationFlags.Type : DeclarationFlags.Value);
						hasGlobalDeclarations = true;
					}
					break;

				case ts.SyntaxKind.ExportDeclaration:
				case ts.SyntaxKind.ExportAssignment:
					// These nodes always indicate an external module
					log.push(`Found export assignment or export declaration`);
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

function getFileKind(mi: ModuleInfo, log: string[]): DefinitionFileKind {
	const globals = Object.keys(mi.globalSymbols).filter(isNewGlobal);
	if (mi.isProperModule) {
		if (mi.hasUmdDecl) {
			log.push(`UMD module declaration detected`);
			return DefinitionFileKind.UMD;
		} else {
			if (mi.ambientModuleCount > 0) {
				log.push(`At least one import declaration and an ambient module declaration, this is a ModuleAugmentation file`);
				return DefinitionFileKind.ModuleAugmentation;
			} else {
				log.push(`At least one export declaration, this is a ProperModule file`);
				return DefinitionFileKind.ProperModule;
			}
		}
	} else {
		if (mi.hasGlobalDeclarations) {
			if (mi.ambientModuleCount === 1) {
				if (globals.length === 1) {
					log.push(`One global declaration and one ambient module declaration, this is an OldUMD file`);
					return DefinitionFileKind.OldUMD;
				} else {
					log.push(`${globals.length} global declarations and one ambient module declaration, this is a Mixed file`);
					return DefinitionFileKind.Mixed;
				}
			} else if (mi.ambientModuleCount > 1) {
				log.push(`Global declarations and multiple ambient module declaration, this is a MultipleModules file`);
				return DefinitionFileKind.MultipleModules;
			} else {
				log.push(`Global declarations and no ambient module declaration, this is a Global file`);
				return DefinitionFileKind.Global;
			}
		} else {
			if (mi.ambientModuleCount === 1) {
				log.push(`Exactly one ambient module declaration, this is a DeclareModule file`);
				return DefinitionFileKind.DeclareModule;
			} else if (mi.ambientModuleCount > 1) {
				log.push(`Multiple ambient module declaration, this is a MultipleModules file`);
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
