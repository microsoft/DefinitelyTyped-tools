import * as ts from "typescript";
import * as fsp from "fs-promise";
import * as path from "path";

import { DefinitionFileKind, RejectionReason, TypingParseSucceedResult, TypingParseFailResult, computeHash, definitelyTypedPath, settings } from "./common";
import { mapAsyncOrdered, readdirRecursive } from "./util";

function stripQuotes(s: string) {
	if (s[0] === '"' || s[0] === "'") {
		return s.substr(1, s.length - 2);
	} else {
		throw new Error(`${s} is not quoted`);
	}
}

const augmentedGlobals = ["Array", "Function", "String", "Number", "Window", "Date", "StringConstructor", "NumberConstructor", "Math", "HTMLElement"];

function isSupportedFileKind(kind: DefinitionFileKind) {
	switch (kind) {
		case DefinitionFileKind.Unknown:
		case DefinitionFileKind.MultipleModules:
		case DefinitionFileKind.Mixed:
		case DefinitionFileKind.DeclareModule:
		case DefinitionFileKind.Global:
		case DefinitionFileKind.ProperModule:
		case DefinitionFileKind.ModuleAugmentation:
		case DefinitionFileKind.UMD:
		case DefinitionFileKind.OldUMD:
			return true;
		default:
			throw new Error("Should not be here");
	}
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

	const declFiles = await readdirRecursive(directory, (file, stats) =>
		// Only include type declaration files.
		stats.isDirectory() || file.endsWith(".d.ts"));
	declFiles.sort();

	log.push(`Found ${declFiles.length} '.d.ts' files`);

	const entryPointResult = entryPoint(folderName, declFiles, log);
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

	if (!isSupportedFileKind(fileKind)) {
		log.push(`Exiting, \`${DefinitionFileKind[fileKind]}\` is not a supported file kind`);
		warnings.push(`\`${DefinitionFileKind[fileKind]}\` is not a supported file kind`);
		return { log, warnings, rejectionReason: RejectionReason.BadFileFormat };
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
	const allFiles = hasPackageJson ? declFiles.concat(["package.json"]) : declFiles;

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
			globals: Object.keys(mi.globalSymbols).filter(k => !!(mi.globalSymbols[k] & DeclarationFlags.Value)),
			declaredModules: mi.declaredModules,
			root: path.resolve(directory),
			files: declFiles,
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
function entryPoint(folderName: string, declFiles: string[], log: string[]): EntryPointSuccess | EntryPointFailure {
	log.push(`Found ${declFiles.length} .d.ts files (${declFiles.join(", ")})`);

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

async function getModuleInfo(directory: string, entryPointFilename: string, log: string[], warnings: string[]): Promise<ModuleInfo> {
	let hasUmdDecl = false;
	let isProperModule = false;
	let hasGlobalDeclarations = false;
	let ambientModuleCount = 0;

	const moduleDependencies: string[] = [];
	const referencedLibraries: string[] = [];
	const declaredModules: string[] = [];

	let globalSymbols: GlobalSymbols = {};
	function recordSymbol(name: string, flags: DeclarationFlags) {
		globalSymbols[name] = (globalSymbols[name] || DeclarationFlags.None) | flags;
	}

	const processQueue = [entryPointFilename];
	const completeList: string[] = [];

	while (processQueue.length > 0) {
		const filename = processQueue.pop();
		if (completeList.includes(filename)) {
			continue;
		}
		completeList.push(filename);

		log.push(`Parse ${filename}`);
		let content = await readFile(directory, filename);

		const src = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
		src.referencedFiles.forEach(ref => {
			// Add referenced files to processing queue
			if (!isRelative(ref)) {
				processQueue.push(path.join(path.dirname(filename), ref.fileName));
			}
		});

		src.typeReferenceDirectives.forEach((ref: { fileName: string }) => {
			if (!referencedLibraries.includes(ref.fileName)) {
				referencedLibraries.push(ref.fileName);
			}
		});

		src.getChildren()[0].getChildren().forEach(node => {
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
						const declName = (node as ts.Declaration).name;
						if (declName) {
							log.push(`Found exported declaration "${(node as ts.Declaration).name.getText()}"`);
						}
						isProperModule = true;
					} else {
						const declName = (node as ts.Declaration).name.getText();
						const isType = node.kind === ts.SyntaxKind.InterfaceDeclaration || node.kind === ts.SyntaxKind.TypeAliasDeclaration;
						log.push(`Found global ${isType ? "type" : "value"} declaration "${declName}"`);
						recordSymbol(declName, isType ? DeclarationFlags.Type : DeclarationFlags.Value);
						hasGlobalDeclarations = true;
					}
					break;

				case ts.SyntaxKind.ImportEqualsDeclaration:
					if ((node as ts.ImportEqualsDeclaration).moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
						const ref = (node as ts.ImportEqualsDeclaration).moduleReference.getText();
						const match = /require\(["'](.*)["']\)/.exec(ref);
						if (match !== null) {
							moduleDependencies.push(match[1]);
							log.push(`Found import = declaration from \`"${ref}"\``);
							isProperModule = true;
						} else {
							warnings.push(`Failed to parse import = declaration "${ref}"`);
						}
					}
					break;

				case ts.SyntaxKind.ImportDeclaration:
					if ((node as ts.ImportDeclaration).moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
						const ref = (node as ts.ImportDeclaration).moduleSpecifier.getText();
						moduleDependencies.push(stripQuotes(ref));
						log.push(`Found import declaration from \`"${ref}"\``);
						isProperModule = true;
					}
					break;

				case ts.SyntaxKind.ExportDeclaration:
				case ts.SyntaxKind.ExportAssignment:
					// These nodes always indicate an external module
					log.push(`Found export assignment or export declaration`);
					isProperModule = true;
					break;

				default:
					throw new Error();
			}
		});
	}
	return { hasUmdDecl, isProperModule, hasGlobalDeclarations, ambientModuleCount, moduleDependencies, referencedLibraries, declaredModules, globalSymbols };
}

function isRelative(ref: ts.FileReference): boolean {
	return ref.fileName.charAt(0) === ".";
}

interface GlobalSymbols {
	[name: string]: ts.SymbolFlags;
}
interface ModuleInfo {
	hasUmdDecl: boolean;
	isProperModule: boolean;
	hasGlobalDeclarations: boolean;
	ambientModuleCount: number;

	moduleDependencies: string[];
	referencedLibraries: string[];
	declaredModules: string[];
	globalSymbols: GlobalSymbols;
}

function getFileKind(mi: ModuleInfo, log: string[]): DefinitionFileKind {
	const globals = Object.keys(mi.globalSymbols).filter(s => !augmentedGlobals.includes(s));
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
	const result = await fsp.readFile(path.join(directory, fileName), { encoding: "utf8" });
	// Skip BOM
	return (result.charCodeAt(0) === 0xFEFF) ? result.substr(1) : result;
}
