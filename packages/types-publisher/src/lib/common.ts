import assert = require("assert");
import path = require("path");
import fs = require("fs");
import crypto = require("crypto");

export const home = path.join(__dirname, "..", "..");
export const settings: PublishSettings = JSON.parse(fs.readFileSync(path.join(home, "settings.json"), "utf-8"));
export const typesDataFilename = "definitions.json";
export const versionsFilename = "versions.json";

export interface AnyPackage {
	packageKind?: "not-needed" | undefined;

	// The name of the library (human readable, e.g. might be "Moment.js" even though packageName is "moment")
	libraryName: string;

	// The NPM name to publish this under, e.g. "jquery". May not be lower-cased yet.
	typingsPackageName: string;

	// e.g. https://github.com/DefinitelyTyped
	sourceRepoURL: string;
}

export interface NotNeededPackage extends AnyPackage {
	packageKind: "not-needed";
}

export interface TypesDataFile {
	[folderName: string]: TypingsData;
}

export interface TypingsData extends AnyPackage {
	kind: string; // Name of a member in DefinitionFileKind

	moduleDependencies: string[];
	libraryDependencies: string[];

	// e.g. "master"
	sourceBranch: string;

	// The name of the primary definition file, e.g. "jquery.d.ts"
	definitionFilename: string;

	// Parsed from "Definitions by:""
	authors: string;

	// Optionally-present name or URL of the project, e.g. "http://cordova.apache.org"
	projectName: string;

	// Names introduced into the global scope by this definition set
	globals: string[];

	// External modules declared by this package. Includes the containing folder name when applicable (e.g. proper module)
	declaredModules: string[];

	// The major version of the library (e.g. "1" for 1.0, "2" for 2.0)
	libraryMajorVersion: string;
	// The minor version of the library
	libraryMinorVersion: string;

	// The full path to the containing folder of all files, e.g. "C:/github/DefinitelyTyped"
	root: string;

	// Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
	files: string[];

	// A hash computed from all files from this definition
	contentHash: string;
}

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
	// More than one 'declare module "foo"'
	MultipleModules,
	// Augments an external module
	ModuleAugmentation,
	// Old-style UMD
	OldUMD
}

export enum RejectionReason {
	TooManyFiles,
	BadFileFormat,
	ReferencePaths
}

export interface TypingParseFailResult {
	rejectionReason: RejectionReason;
	log: string[];
	warnings: string[];
}

export interface TypingParseSucceedResult {
	data: TypingsData;
	log: string[];
	warnings: string[];
}

export class Log {
	infos: string[];
	errors: string[];

	constructor() {
		this.infos = [];
		this.errors = [];
	}

	info(message: string): void {
		this.infos.push(message);
	}

	error(message: string): void {
		this.errors.push(message);
	}
}

export function isNotNeededPackage(pkg: AnyPackage): pkg is NotNeededPackage {
	return pkg.packageKind === "not-needed";
}

export function isSuccess(t: TypingParseSucceedResult | TypingParseFailResult): t is TypingParseSucceedResult {
	return (t as TypingParseSucceedResult).data !== undefined;
}

export function isFail(t: TypingParseSucceedResult | TypingParseFailResult): t is TypingParseFailResult {
	return (t as TypingParseFailResult).rejectionReason !== undefined;
}

export function mkdir(p: string) {
	try {
		fs.statSync(p);
	} catch (e) {
		fs.mkdirSync(p);
	}
}

export function writeLogSync(logName: string, contents: string[]) {
	const logDir = path.join(home, "logs");
	mkdir(logDir);
	fs.writeFileSync(path.join(logDir, logName), contents.join("\r\n"), "utf-8");
}

export function writeDataFile(filename: string, content: {}, formatted = true) {
	const dataDir = path.join(home, "data");
	mkdir(dataDir);
	if (typeof content !== "string") {
		content = JSON.stringify(content, undefined, formatted ? 4 : undefined);
	}
	fs.writeFileSync(path.join(dataDir, filename), content, "utf-8");
}

export function readDataFile(filename: string): {} {
	const dataDir = path.join(home, "data");
	const fullPath = path.join(dataDir, filename);
	if (fs.existsSync(fullPath)) {
		return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
	} else {
		return undefined;
	}
}

export function readNotNeededPackages(): NotNeededPackage[] {
	const raw: NotNeededPackage[] = JSON.parse(fs.readFileSync("./notNeededPackages.json", "utf-8")).packages;
	for (const pkg of raw) {
		assert(pkg.libraryName && pkg.typingsPackageName && pkg.sourceRepoURL);
		pkg.packageKind = "not-needed";
	}
	return raw;
}

export function computeHash(content: string) {
	const h = crypto.createHash("sha256");
	h.update(content, "utf-8");
	return <string> h.digest("hex");
}

export function getOutputPath({typingsPackageName}: AnyPackage) {
	return path.join(settings.outputPath, typingsPackageName);
}

export function fullPackageName(typingsPackageName: string): string {
	return `@${settings.scopeName}/${typingsPackageName.toLowerCase()}`;
}

export function notNeededReadme({libraryName, typingsPackageName, sourceRepoURL}: NotNeededPackage): string {
	return `This is a stub types definition for ${libraryName} (${sourceRepoURL}).
${libraryName} provides its own type definitions, so you don't need ${fullPackageName(typingsPackageName)} installed!`;
}
