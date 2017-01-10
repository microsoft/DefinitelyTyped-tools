import assert = require("assert");
import * as path from "path";
import * as ts from "typescript";

import { Logger } from "../util/logging";
import { isExternalModule } from "../util/ts";
import { hasWindowsSlashes, joinPaths, mapDefined, normalizeSlashes, stripQuotes, sort } from "../util/util";

import { readFile } from "./definition-parser";

export default async function getModuleInfo(packageName: string, directory: string, allEntryFilenames: string[], log: Logger): Promise<ModuleInfo> {
	let hasUmdDecl = false;
	let hasGlobalDeclarations = false;
	let ambientModuleCount = 0;

	const dependencies = new Set<string>();
	const declaredModules: string[] = [];

	const globalSymbols = new Map<string, DeclarationFlags>();
	function recordSymbol(name: string, flags: DeclarationFlags): void {
		globalSymbols.set(name, (globalSymbols.get(name) || DeclarationFlags.None) | flags);
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
					globalSymbols.set(globalName, DeclarationFlags.Value);
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
								noWindowsSlashes(packageName, name);

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
					throw new Error(`Bad node in ${joinPaths(directory, src.fileName)}: '${node.getText()}' is of kind ${ts.SyntaxKind[node.kind]}`);
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
		dependencies,
		declaredModules,
		globals: sort(mapDefined(globalSymbols, ([k, v]) => v & DeclarationFlags.Value ? k : undefined))
	};
}

interface ModuleInfo {
	// Every declaration file used (starting from the entry point)
	declFiles: string[];
	dependencies: Set<string>;
	// Anything from a `declare module "foo"`
	declaredModules: string[];
	// Every global symbol
	globals: string[];
}

/**
 * Given a file name, get the name of the module it declares.
 * `foo/index.d.ts` declares "foo", `foo/bar.d.ts` declares "foo/bar", "foo/bar/index.d.ts" declares "foo/bar"
 */
function properModuleName(folderName: string, fileName: string): string {
	const part = path.basename(fileName) === "index.d.ts" ? path.dirname(fileName) : withoutExtension(fileName, ".d.ts");
	return joinPaths(folderName, part);
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

function withoutExtension(str: string, ext: string): string {
	assert(str.endsWith(ext));
	return str.slice(0, str.length - ext.length);
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
		await Promise.all(refs.map(ref => recur(filename, ref)));
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
		noWindowsSlashes(src.fileName, ref);
		let full = path.normalize(joinPaths(subDirectory, ref));
		// `path.normalize` may add windows slashes
		full = normalizeSlashes(full);
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

const enum DeclarationFlags {
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

function noWindowsSlashes(packageName: string, fileName: string): void {
	if (hasWindowsSlashes(fileName)) {
		throw new Error(`In ${packageName}: Use forward slash instead when referencing ${fileName}`);
	}
}
