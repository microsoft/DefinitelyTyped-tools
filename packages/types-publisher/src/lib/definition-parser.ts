import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

import { DefinitionFileKind, RejectionReason, TypingParseSucceedResult, TypingParseFailResult, computeHash, settings } from "./common";

function stripQuotes(s: string) {
	if (s[0] === '"' || s[0] === "'") {
		return s.substr(1, s.length - 2);
	} else {
		throw new Error(`${s} is not quoted`);
	}
}

const augmentedGlobals = ["Array", " Function", "String", "Number", "Window", "Date", "StringConstructor", "NumberConstructor", "Math", "HTMLElement"];

const pathToLibrary = /\.\.\/([^\/]+)\//;

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

export function getTypingInfo(directory: string): TypingParseFailResult | TypingParseSucceedResult {
	const log: string[] = [];
	const warnings: string[] = [];
	const folderName = path.basename(directory);

	log.push(`Reading contents of ${directory}`);
	const files = fs.readdirSync(directory);

	// Kinds of files we can have here:
	//  * .d.ts (definition)
	//  * -tests.ts (tests)
	//  * .d.ts.tscparams (for testing)

	log.push(`Found ${files.length} files`);

	const declFiles = files.filter(f => /\.d\.ts$/.test(f));
	const candidates = [folderName + ".d.ts", "index.d.ts"];
	log.push(`Found ${declFiles.length} .d.ts files (${declFiles.join(", ")})`);

	let entryPointFilename: string;
	if (declFiles.length === 1) {
		entryPointFilename = declFiles[0];
	}
	else if (declFiles.length > 1) {
		// You can have [foldername].d.ts, or index.d.ts to rescue yourself from this situation
		for (const candidate of candidates) {
			if (declFiles.indexOf(candidate) >= 0) {
				log.push(`Used ${candidate} as entry point`);
				entryPointFilename = candidate;
				break;
			}
		}
	}
	declFiles.sort();

	if (entryPointFilename === undefined) {
		const msg = "Exiting, found either zero or more than one .d.ts file and none of " + candidates.map(c => "`" + c + "`").join(" or ");
		log.push(msg);
		warnings.push(msg);
		return { log, warnings, rejectionReason: RejectionReason.TooManyFiles };
	}
	const entryPointContent = readFile(entryPointFilename);

	let hasUmdDecl = false;
	let isProperModule = false;
	let hasGlobalDeclarations = false;
	let ambientModuleCount = 0;

	const moduleDependencies: string[] = [];
	const referencedLibraries: string[] = [];
	const declaredModules: string[] = [];

	let globalSymbols: { [name: string]: ts.SymbolFlags } = {};
	function recordSymbol(name: string, flags: DeclarationFlags) {
		globalSymbols[name] = (globalSymbols[name] || DeclarationFlags.None) | flags;
	}

	const processQueue = [entryPointFilename];
	const completeList: string[] = [];

	while (processQueue.length > 0) {
		const filename = processQueue.pop();
		if (completeList.indexOf(filename) >= 0) {
			continue;
		}
		completeList.push(filename);

		log.push(`Parse ${filename}`);
		let content = readFile(filename);

		const src = ts.createSourceFile("test.d.ts", content, ts.ScriptTarget.Latest, true);
		src.referencedFiles.forEach(ref => {
			// Add referenced files to processing queue
			if (ref.fileName.charAt(0) !== ".") {
				processQueue.push(path.join(path.dirname(filename), ref.fileName));
			}

			// If this is a ../reference, treat it as a library
			const pathMatch = pathToLibrary.exec(ref.fileName);
			if (pathMatch) {
				referencedLibraries.push(pathMatch[1]);
			}
		});

		src.typeReferenceDirectives.forEach((ref: { fileName: string }) => {
			if (referencedLibraries.indexOf(ref.fileName) < 0) {
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

	const globals = Object.keys(globalSymbols).filter(s => augmentedGlobals.indexOf(s) < 0);

	let fileKind = DefinitionFileKind.Unknown;
	if (isProperModule) {
		if (hasUmdDecl) {
			log.push(`UMD module declaration detected`);
			fileKind = DefinitionFileKind.UMD;
		} else {
			if (ambientModuleCount > 0) {
				log.push(`At least one import declaration and an ambient module declaration, this is a ModuleAugmentation file`);
				fileKind = DefinitionFileKind.ModuleAugmentation;
			} else {
				log.push(`At least one export declaration, this is a ProperModule file`);
				fileKind = DefinitionFileKind.ProperModule;
			}
		}
	} else {
		if (hasGlobalDeclarations) {
			if (ambientModuleCount === 1) {
				if (globals.length === 1) {
					log.push(`One global declaration and one ambient module declaration, this is an OldUMD file`);
					fileKind = DefinitionFileKind.OldUMD;
				} else {
					log.push(`${globals.length} global declarations and one ambient module declaration, this is a Mixed file`);
					fileKind = DefinitionFileKind.Mixed;
				}
			} else if (ambientModuleCount > 1) {
				log.push(`Global declarations and multiple ambient module declaration, this is a MultipleModules file`);
				fileKind = DefinitionFileKind.MultipleModules;
			} else {
				log.push(`Global declarations and no ambient module declaration, this is a Global file`);
				fileKind = DefinitionFileKind.Global;
			}
		} else {
			if (ambientModuleCount === 1) {
				log.push(`Exactly one ambient module declaration, this is a DeclareModule file`);
				fileKind = DefinitionFileKind.DeclareModule;
			} else if (ambientModuleCount > 1) {
				log.push(`Multiple ambient module declaration, this is a MultipleModules file`);
				fileKind = DefinitionFileKind.MultipleModules;
			}
		}
	}

	if (declaredModules.length === 1 && fileKind !== DefinitionFileKind.ModuleAugmentation && declaredModules[0].toLowerCase() !== folderName.toLowerCase()) {
		warnings.push(`Declared module \`${declaredModules[0]}\` is in folder with incorrect name \`${folderName}\``);
	}

	if (declaredModules.length === 0 && fileKind === DefinitionFileKind.ProperModule) {
		declaredModules.push(folderName);
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
	const libraryMajorVersion = regexMatch(/^\/\/ Type definitions for \D+ v?(\d+)/m, "0");
	const libraryMinorVersion = regexMatch(/^\/\/ Type definitions for \D+ v?\d+\.(\d+)/m, "0");
	// const libraryName = regexMatch(/^\/\/ Type definitions for ([^\s]+)/m, "Unknown").trim();
	const libraryName = regexMatch(/^\/\/ Type definitions for (.+)$/m, "Unknown").trim();
	const projectName = regexMatch(/^\/\/ Project: (.+)$/m, "");
	const packageName = path.basename(directory);
	const sourceRepoURL = "https://www.github.com/DefinitelyTyped/DefinitelyTyped";

	if (packageName !== packageName.toLowerCase()) {
		warnings.push(`Package name \`${packageName}\` should be strictly lowercase`);
	}

	const allContent = declFiles.map(d => d + "**" + readFile(d)).join("||");

	return {
		log,
		warnings,
		data: {
			authors,
			definitionFilename: entryPointFilename,
			libraryDependencies: referencedLibraries,
			moduleDependencies,
			libraryMajorVersion,
			libraryMinorVersion,
			libraryName,
			typingsPackageName: folderName.toLowerCase(),
			projectName,
			sourceRepoURL,
			sourceBranch: settings.sourceBranch,
			kind: DefinitionFileKind[fileKind],
			globals: Object.keys(globalSymbols).filter(k => !!(globalSymbols[k] & DeclarationFlags.Value)),
			declaredModules,
			root: path.resolve(directory),
			files: declFiles,
			contentHash: computeHash(allContent)
		}
	};

	function readFile(fileName: string) {
		const result = fs.readFileSync(path.join(directory, fileName), "utf-8");
		// Skip BOM
		return (result.charCodeAt(0) === 0xFEFF) ? result.substr(1) : result;
	}
}
