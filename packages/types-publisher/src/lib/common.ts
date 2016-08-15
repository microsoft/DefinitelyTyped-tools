import assert = require("assert");
import path = require("path");
import { existsSync, readFileSync } from "fs";
import * as fsp from "fs-promise";
import crypto = require("crypto");
import { install } from "source-map-support";
import { LogWithErrors } from "./logging";
import { parseJson, readJson, writeFile } from "./util";
install();
if (process.env["LONGJOHN"]) {
	console.log("=== USING LONGJOHN ===");
	const longjohn = require("longjohn");
	longjohn.async_trace_limit = -1; // unlimited
}

export const home = path.join(__dirname, "..", "..");
export const settings: PublishSettings = parseJson(readFileSync(path.join(home, "settings.json"), "utf-8"));
export const typesDataFilename = "definitions.json";
export const notNeededPackagesPath = path.join(settings.definitelyTypedPath, "notNeededPackages.json");

export interface AnyPackage {
	packageKind?: "not-needed" | undefined;

	// The name of the library (human readable, e.g. might be "Moment.js" even though packageName is "moment")
	libraryName: string;

	// The NPM name to publish this under, e.g. "jquery". May not be lower-cased yet.
	typingsPackageName: string;

	// e.g. https://github.com/DefinitelyTyped
	sourceRepoURL: string;

	// Optionally-present name or URL of the project, e.g. "http://cordova.apache.org"
	projectName: string | undefined;

	// Names introduced into the global scope by this definition set
	globals: string[] | undefined;

	// External modules declared by this package. Includes the containing folder name when applicable (e.g. proper module)
	declaredModules: string[] | undefined;
}

export interface NotNeededPackage extends AnyPackage {
	packageKind: "not-needed";
	/**
	 * If this is available, @types typings are deprecated as of this version.
	 * This is useful for packages that previously had DefinitelyTyped definitions but which now provide their own.
	 */
	asOfVersion?: string;
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

	// Parsed from "Definitions by:"
	authors: string;

	// The major version of the library (e.g. "1" for 1.0, "2" for 2.0)
	libraryMajorVersion: string;
	// The minor version of the library
	libraryMinorVersion: string;

	// The full path to the containing folder of all files, e.g. "C:/github/DefinitelyTyped/some-package"
	root: string;

	// Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
	// Does *not* include a partial `package.json` because that will not be copied directly.
	files: string[];

	// Whether a "package.json" exists
	hasPackageJson: boolean;

	// A hash computed from all files from this definition
	contentHash: string;
}

export enum RejectionReason {
	TooManyFiles,
	BadFileFormat,
	ReferencePaths
}

export interface TypingParseFailResult {
	rejectionReason: RejectionReason;
	logs: LogWithErrors;
}

export interface TypingParseSucceedResult {
	data: TypingsData;
	logs: LogWithErrors;
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

export async function writeDataFile(filename: string, content: {}, formatted = true) {
	const dataDir = path.join(home, "data");
	await fsp.ensureDir(dataDir);
	await writeFile(path.join(dataDir, filename), JSON.stringify(content, undefined, formatted ? 4 : undefined));
}

const dataDir = path.join(home, "data");
function dataFilePath(filename: string) {
	return path.join(dataDir, filename);
}

export function existsTypesDataFileSync(): boolean {
	return existsSync(dataFilePath(typesDataFilename));
}

export async function readTypesDataFile(): Promise<TypesDataFile> {
	return <TypesDataFile> (await readJson(dataFilePath(typesDataFilename)));
}
export function typingsFromData(typeData: TypesDataFile): TypingsData[] {
	return Object.keys(typeData).map(packageName => typeData[packageName]);
}
export async function readTypings(): Promise<TypingsData[]> {
	return typingsFromData(await readTypesDataFile());
}

export async function readNotNeededPackages(): Promise<NotNeededPackage[]> {
	const raw: any[] = (await readJson(notNeededPackagesPath)).packages;
	for (const pkg of raw) {
		for (const key in pkg) {
			if (!["libraryName", "typingsPackageName", "sourceRepoURL", "asOfVersion"].includes(key)) {
				throw new Error(`Unexpected key in not-needed package: ${key}`);
			}
		}
		assert(pkg.libraryName && pkg.typingsPackageName && pkg.sourceRepoURL);
		assert(typeof pkg.asOfVersion === "string" || typeof pkg.asOfVersion === "undefined");
		assert(!pkg.projectName && !pkg.packageKind && !pkg.globals && !pkg.declaredModules);

		pkg.projectName = pkg.sourceRepoURL;
		pkg.packageKind = "not-needed";
		pkg.globals = [];
		pkg.declaredModules = [];
	}
	return raw;
}

export async function readAllPackages(): Promise<AnyPackage[]> {
	const [typings, notNeeded] = await Promise.all<AnyPackage[]>([ readTypings(), readNotNeededPackages() ]);
	return typings.concat(notNeeded);
}

export function computeHash(content: string) {
	// Normalize line endings
	content = content.replace(/\r\n?/g, "\n");

	const h = crypto.createHash("sha256");
	h.update(content, "utf-8");
	return <string> h.digest("hex");
}

export function definitelyTypedPath(dirName: string): string {
	return path.join(settings.definitelyTypedPath, dirName);
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
