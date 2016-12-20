import assert = require("assert");
import path = require("path");
import { existsSync, readFileSync } from "fs";
import * as fsp from "fs-promise";
import crypto = require("crypto");
import * as sourceMapSupport from "source-map-support";

import { readJson, writeJson } from "../util/io";
import { parseJson } from "../util/util";

sourceMapSupport.install();
if (process.env.LONGJOHN) {
	console.log("=== USING LONGJOHN ===");
	const longjohn = require("longjohn");
	longjohn.async_trace_limit = -1; // unlimited
}

export const home = path.join(__dirname, "..", "..");
export const settings: PublishSettings = parseJson(readFileSync(path.join(home, "settings.json"), "utf-8"));
export const typesDataFilename = "definitions.json";
function notNeededPackagesPath(options: Options) {
	return path.join(options.definitelyTypedPath, "notNeededPackages.json");
}

/** Settings that may be determined dynamically. */
export interface Options {
	// e.g. '../DefinitelyTyped'
	// This is overridden to `cwd` when running the tester, as that is run from within DefinitelyTyped.
	definitelyTypedPath: string;
}
export namespace Options {
	export const defaults: Options = {
		definitelyTypedPath: "../DefinitelyTyped",
	};
}

export type AnyPackage = NotNeededPackage | TypingsData;

/** Prefer to use `AnyPackage` instead of this. */
export interface PackageCommonProperties {
	// The name of the library (human readable, e.g. might be "Moment.js" even though packageName is "moment")
	libraryName: string;

	// The NPM name to publish this under, e.g. "jquery". Does not include "@types".
	typingsPackageName: string;

	// e.g. https://github.com/DefinitelyTyped
	sourceRepoURL: string;

	// Optionally-present name or URL of the project, e.g. "http://cordova.apache.org"
	projectName: string;

	// Names introduced into the global scope by this definition set
	globals: string[];

	// External modules declared by this package. Includes the containing folder name when applicable (e.g. proper module)
	declaredModules: string[];
}

export interface NotNeededPackage extends PackageCommonProperties {
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

export type TypeScriptVersion = "2.0" | "2.1";
export namespace TypeScriptVersion {
	export const All: TypeScriptVersion[] = ["2.0", "2.1"];
	export const Latest = "2.1";

	export function isPrerelease(version: TypeScriptVersion): boolean {
		return version === "2.1";
	}

	/** List of NPM tags that should be changed to point to the latest version. */
	export function tagsToUpdate(typeScriptVersion: TypeScriptVersion): string[]  {
		switch (typeScriptVersion) {
			case "2.0":
				// A 2.0-compatible package is assumed compatible with TypeScript 2.1
				// We want the "2.1" tag to always exist.
				return [tags.latest, tags.v2_0, tags.v2_1];
			case "2.1":
				// Eventually this will change to include "latest", too.
				// And obviously we shouldn't advance the "2.0" tag if the package is now 2.1-specific.
				return [tags.v2_1];
		}
	}

	namespace tags {
		export const latest = "latest";
		export const v2_0 = "ts2.0";
		export const v2_1 = "ts2.1";
	}
}

export interface TypingsData extends PackageCommonProperties {
	/**
	 * Never include this property;
	 * the declaration is just here so that the AnyPackage union is discriminated by `packageKind`.
	 */
	packageKind?: undefined;

	moduleDependencies: string[];
	libraryDependencies: string[];

	// e.g. "master"
	sourceBranch: string;

	// Parsed from "Definitions by:"
	authors: string;

	// The major version of the library (e.g. "1" for 1.0, "2" for 2.0)
	libraryMajorVersion: number;
	// The minor version of the library
	libraryMinorVersion: number;

	typeScriptVersion: TypeScriptVersion;

	// Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
	// Does *not* include a partial `package.json` because that will not be copied directly.
	files: string[];

	// Whether a "package.json" exists
	hasPackageJson: boolean;

	// A hash computed from all files from this definition
	contentHash: string;
}

export function isNotNeededPackage(pkg: AnyPackage): pkg is NotNeededPackage {
	return pkg.packageKind === "not-needed";
}

export function existsDataFileSync(filename: string): boolean {
	return existsSync(dataFilePath(filename));
}

export function readDataFile(filename: string): Promise<any> {
	return readJson(dataFilePath(filename));
}

export async function writeDataFile(filename: string, content: {}, formatted = true) {
	await fsp.ensureDir(dataDir);
	await writeJson(dataFilePath(filename), content, formatted);
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

/**
 * Read all typings and extract a single one.
 * Do *not* call this in a loop; use `readTypings` instead.
 */
export async function readPackage(packageName: string): Promise<TypingsData> {
	return getPackage(await readTypesDataFile(), packageName);
}

export function getPackage(typings: TypesDataFile, packageName: string): TypingsData {
	const pkg = typings[packageName];
	if (pkg === undefined) {
		throw new Error(`Can't find package ${packageName}`);
	}
	return pkg;
}

export function typingsFromData(typeData: TypesDataFile): TypingsData[] {
	return Object.values(typeData);
}
export async function readTypings(): Promise<TypingsData[]> {
	return typingsFromData(await readTypesDataFile());
}

export async function readNotNeededPackages(options: Options): Promise<NotNeededPackage[]> {
	const raw: any[] = (await readJson(notNeededPackagesPath(options))).packages;
	for (const pkg of raw) {
		for (const key in pkg) {
			if (!["libraryName", "typingsPackageName", "sourceRepoURL", "asOfVersion"].includes(key)) {
				throw new Error(`Unexpected key in not-needed package: ${key}`);
			}
		}
		assert(pkg.libraryName && pkg.typingsPackageName && pkg.sourceRepoURL);
		assert(typeof pkg.asOfVersion === "string" || pkg.asOfVersion === undefined);
		assert(!pkg.projectName && !pkg.packageKind && !pkg.globals && !pkg.declaredModules);

		pkg.projectName = pkg.sourceRepoURL;
		pkg.packageKind = "not-needed";
		pkg.globals = [];
		pkg.declaredModules = [];
	}
	return raw;
}

export interface AllPackages {
	typings: TypingsData[];
	notNeeded: NotNeededPackage[];
}

export async function readAllPackages(options: Options): Promise<AllPackages> {
	return { typings: await readTypings(), notNeeded: await readNotNeededPackages(options) };
}

export async function readAllPackagesArray(options: Options): Promise<AnyPackage[]> {
	const {typings, notNeeded} = await readAllPackages(options);
	return (typings as AnyPackage[]).concat(notNeeded);
}

export function computeHash(content: string) {
	// Normalize line endings
	content = content.replace(/\r\n?/g, "\n");

	const h = crypto.createHash("sha256");
	h.update(content, "utf8");
	return <string> h.digest("hex");
}

export function packagePath(pkg: TypingsData, options: Options): string {
	return definitelyTypedPath(pkg.typingsPackageName, options);
}

export function filePath(pkg: TypingsData, fileName: string, options: Options): string {
	return path.join(packagePath(pkg, options), fileName);
}

export function definitelyTypedPath(dirName: string, options: Options): string {
	return path.join(options.definitelyTypedPath, dirName);
}

const outputDir = path.join(home, settings.outputPath);
export function getOutputPath({typingsPackageName}: AnyPackage) {
	return path.join(outputDir, typingsPackageName);
}

export function fullPackageName(typingsPackageName: string): string {
	return `@${settings.scopeName}/${typingsPackageName}`;
}

export function notNeededReadme({libraryName, typingsPackageName, sourceRepoURL}: NotNeededPackage, useNewline: boolean = true): string {
	const lines = [
		`This is a stub types definition for ${libraryName} (${sourceRepoURL}).`,
		`${libraryName} provides its own type definitions, so you don't need ${fullPackageName(typingsPackageName)} installed!`
	];
	return lines.join(useNewline ? "\n" : " ");
}
