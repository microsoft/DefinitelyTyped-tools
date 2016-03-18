import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export enum DefinitionFileKind {
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
	// More than one 'declare module "foo"''
	MultipleModules,
	// Augments an external module
	ModuleAugmentation
}

export interface TypingParseResult {
	data?: TypingsData;
	log: string[];
}

export interface TypingsData {
	type: DefinitionFileKind;

	moduleDependencies: string[];
	libraryDependencies: string[];

	// e.g. https://github.com/DefinitelyTyped
	sourceRepoURL: string;

	// The name of the primary definition file
	definitionFilename: string;

	// The name of the library (human readable, e.g. might be 'Moment.js' even though packageName is 'moment')
	libraryName: string;

	// True if the 'packageName' corresponds to the NPM package of the same name
	hasNpmPackage: boolean;

	// The NPM name to publish this under
	packageName: string;
	// Parsed from 'Definitions by:'
	authors: string;
	// Parent folder name in the source repo
	folder: string;

	// The major version of the library (e.g. '1' for 1.0, '2' for 2.0)
	libraryMajorVersion: string;
	// The minor version of the library
	libraryMinorVersion: string;
}

function isSupportedFileKind(kind: DefinitionFileKind) {
	switch(kind) {
		case DefinitionFileKind.Unknown:
		case DefinitionFileKind.MultipleModules:
		case DefinitionFileKind.Mixed:
		case DefinitionFileKind.DeclareModule:
			return false;
		case DefinitionFileKind.Global:
		case DefinitionFileKind.ProperModule:
		case DefinitionFileKind.ModuleAugmentation:
		case DefinitionFileKind.UMD:
			return true;
		default:
			throw new Error('Should not be here');
	}
}

export function getTypingInfo(directory: string): TypingParseResult {
	const log: string[] = [];

	log.push(`Reading contents of ${directory}`);
	const files = fs.readdirSync(directory);

	// Kinds of files we can have here:
	//  * .d.ts (definition)
	//  * -tests.ts (tests)
	//  * .d.ts.tscparams (for testing)

	// "// Type definitions for JSFL v3.2"

	log.push(`Found ${files.length} files`);

	const declFiles = files.filter(f => /\.d\.ts$/.test(f));
	log.push(`Found ${declFiles.length} .d.ts files (${declFiles.join(', ')})`);

	if (declFiles.length !== 1) {
		log.push('Exiting, can only process directories with exactly 1 .d.ts file');
		return { log };
	}

	const declFilename = declFiles[0];
	log.push(`Parse ${declFilename}`);
	const fullPath = path.join(directory, declFilename);

	const content = fs.readFileSync(fullPath, 'utf-8');
	const src = ts.createSourceFile('test.d.ts', content, ts.ScriptTarget.Latest, true);

	let hasUmdDecl = false;
	let isProperModule = false;
	let hasGlobalDeclarations = false;
	let ambientModuleCount = 0;

	const moduleDependencies: string[] = [];

	src.getChildren()[0].getChildren().forEach(node => {
		switch(node.kind) {
			case ts.SyntaxKind.GlobalModuleExportDeclaration:
				log.push(`Found UMD module declaration for global ${(node as ts.GlobalModuleExportDeclaration).name.getText()}`);
				isProperModule = true;
				hasUmdDecl = true;
				break;

			case ts.SyntaxKind.ModuleDeclaration:
				if (node.flags & ts.NodeFlags.Export) {
					log.push(`Found exported namespace "${(node as ts.ModuleDeclaration).name.getText()}"`);
					isProperModule = true;
				} else {
					const nameKind = (node as ts.ModuleDeclaration).name.kind;
					if (nameKind === ts.SyntaxKind.StringLiteral) {
						log.push(`Found ambient external module ${(node as ts.ModuleDeclaration).name.getText()}`);
						ambientModuleCount++;
					} else {
						log.push(`Found global namespace declaration "${(node as ts.ModuleDeclaration).name.getText()}"`);
						hasGlobalDeclarations = true;
					}
				}
				break;

			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.VariableDeclaration:
			case ts.SyntaxKind.VariableStatement:
			case ts.SyntaxKind.EnumDeclaration:
			case ts.SyntaxKind.TypeAliasDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.FunctionDeclaration:
				// If these nodes have an 'export' modifier, the file is an external module
				if (node.flags & ts.NodeFlags.Export) {
					log.push(`Found exported declaration "${(node as ts.Declaration).name.getText()}"`);
					isProperModule = true;
				} else {
					const declName = (node as ts.Declaration).name;
					if(declName) {
						log.push(`Found global declaration "${(node as ts.Declaration).name.getText()}"`);
					} else {
						log.push(`Found global declaration`);
					}
					
					hasGlobalDeclarations = true;
				}
				break;

			case ts.SyntaxKind.ImportEqualsDeclaration:
				if((node as ts.ImportEqualsDeclaration).moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
					const ref = (node as ts.ImportEqualsDeclaration).moduleReference.getText();
					moduleDependencies.push(ref);
					log.push(`Found import = declaration from ${ref}`);
					isProperModule = true;
				}
				break;

			case ts.SyntaxKind.ImportDeclaration:
				if((node as ts.ImportDeclaration).moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
					const ref = (node as ts.ImportDeclaration).moduleSpecifier.getText();
					moduleDependencies.push(ref);
					log.push(`Found import declaration from ${ref}`);
					isProperModule = true;
				}
				break;

			case ts.SyntaxKind.ExportDeclaration:
			case ts.SyntaxKind.ExportAssignment:
				// These nodes always indicate an external module
				log.push(`Found export assignment or export declaration`);
				isProperModule = true;
				break;
		}
	});

	let fileKind = DefinitionFileKind.Unknown;
	if (isProperModule) {
		if (hasUmdDecl) {
			log.push(`UMD module declaration detected`);
			fileKind = DefinitionFileKind.UMD;
		} else {
			if(ambientModuleCount > 0) {
				log.push(`At least one import declaration and an ambient module declaration, this is a ModuleAugmentation file`);
				fileKind = DefinitionFileKind.ModuleAugmentation;
			} else {
				log.push(`At least one export declaration, this is a ProperModule file`);
				fileKind = DefinitionFileKind.ProperModule;
			}
		}
	} else {
		if (hasGlobalDeclarations) {
			if (ambientModuleCount == 1) {
				log.push(`Global declarations and one ambient module declaration, this is a Mixed file`);
				fileKind = DefinitionFileKind.Mixed;
			} else if(ambientModuleCount > 1) {
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

	if(!isSupportedFileKind(fileKind)) {
		log.push(`${DefinitionFileKind[fileKind]} is not a supported file kind`);
		return { log };
	}

	if (src.referencedFiles.length > 0) {
		log.push(`Typings files cannot have "/// <reference path=...>"" directives`);
		return { log };
	}

	function regexMatch(rx: RegExp, defaultValue: string): string {
		const match = rx.exec(content);
		return match ? match[1] : defaultValue;
	}

	const authors = regexMatch(/^\/\/ Definitions by: (.+)$/, 'Unknown');
	const libraryMajorVersion = regexMatch(/^\/\/ Type definitions for \D+ (\d+)/, '0');
	const libraryMinorVersion = regexMatch(/^\/\/ Type definitions for \D+ \d+\.(\d+)/, '0');
	const libraryName = regexMatch(/^\/\/ Type definitions for (\D+)/, 'Unknown').trim();
	const packageName = isProperModule ? path.basename(directory) : undefined;
	const sourceRepoURL = 'https://www.github.com/DefinitelyTyped/DefinitelyTyped';
	
	return {
		log,
		data: {
			authors,
			definitionFilename: declFilename,
			libraryDependencies: src['referencedLibraries'],
			moduleDependencies,
			folder: path.basename(directory),
			hasNpmPackage: false,
			libraryMajorVersion,
			libraryMinorVersion,
			libraryName,
			packageName,
			sourceRepoURL,
			type: fileKind
		}
	}	
}
