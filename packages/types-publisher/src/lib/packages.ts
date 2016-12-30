import assert = require("assert");
import * as path from "path";

import { readJson } from "../util/io";
import { mapValues } from "../util/util";

import { Options, home, readDataFile, settings } from "./common";

export class AllPackages {
	static async read(options: Options): Promise<AllPackages> {
		const data = await readTypesDataFile();
		const map = mapValues(new Map(Object.entries(data)), raw => new TypingsData(raw));
		const notNeeded = (await readNotNeededPackages(options)).map(raw => new NotNeededPackage(raw));
		return new AllPackages(map, notNeeded);
	}

	static async readTypings(): Promise<TypingsData[]> {
		return Object.values(await readTypesDataFile()).map(raw => new TypingsData(raw));
	}

	static async readSingle(name: string): Promise<TypingsData> {
		const data = await readTypesDataFile();
		const raw = data[name];
		if (!raw) {
			throw new Error(`Can't find package ${name}`);
		}
		return new TypingsData(raw);
	}

	private constructor(
		private data: Map<string, TypingsData>,
		private notNeeded: NotNeededPackage[]) {}

	getAnyPackage(name: string): AnyPackage {
		let pkg: AnyPackage | undefined = this.tryGetTypingsData(name) || this.notNeeded.find(p => p.typingsPackageName === name);
		if (!pkg) {
			throw new Error(`Expected to find a package named ${name}`);
		}
		return pkg;
	}

	tryGetTypingsData(packageName: string): TypingsData | undefined {
		return this.data.get(packageName);
	}

	hasTypingFor(packageName: string): boolean {
		return this.data.has(packageName);
	}

	getTypingsData(packageName: string): TypingsData {
		const pkg = this.tryGetTypingsData(packageName);
		if (!pkg) {
			throw new Error(`Can't find package ${packageName}`);
		}
		return pkg;
	}

	allPackages(): AnyPackage[] {
		return (this.allTypings() as AnyPackage[]).concat(this.allNotNeeded());
	}

	allTypings(): TypingsData[] {
		return Array.from(this.data.values());
	}

	allNotNeeded(): NotNeededPackage[] {
		return this.notNeeded;
	}
}

export const typesDataFilename = "definitions.json";

export type AnyPackage = NotNeededPackage | TypingsData;

interface BaseRaw {
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

/** Prefer to use `AnyPackage` instead of this. */
export class PackageBase implements BaseRaw {
	libraryName: string;
	typingsPackageName: string;
	sourceRepoURL: string;
	projectName: string;
	globals: string[];
	declaredModules: string[];

	constructor(data: any) {
		Object.assign(this, data);
	}

	isNotNeeded(): this is NotNeededPackage {
		return this instanceof NotNeededPackage;
	}

	getOutputPath(): string {
		return path.join(outputDir, this.typingsPackageName);
	}

	fullName(): string {
		return fullPackageName(this.typingsPackageName);
	}

	fullEscapedName() {
		return `@${settings.scopeName}%2f${this.typingsPackageName}`;
	}

	outputDir() {
		return path.join(outputDir, this.typingsPackageName);
	}
}

export function fullPackageName(packageName: string) {
	return `@${settings.scopeName}/${packageName}`;
}

const outputDir = path.join(home, settings.outputPath);

interface NotNeededPackageRaw extends PackageBase {
	/**
	 * If this is available, @types typings are deprecated as of this version.
	 * This is useful for packages that previously had DefinitelyTyped definitions but which now provide their own.
	 */
	asOfVersion?: string;
}

export class NotNeededPackage extends PackageBase {
	asOfVersion?: string;

	readme(useNewline = true): string {
		const lines = [
			`This is a stub types definition for ${this.libraryName} (${this.sourceRepoURL}).`,
			`${this.libraryName} provides its own type definitions, so you don't need ${fullPackageName(this.typingsPackageName)} installed!`
		];
		return lines.join(useNewline ? "\n" : " ");
	}
}

export interface TypingsDataRaw extends BaseRaw {
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

export class TypingsData extends PackageBase implements TypingsDataRaw {
	moduleDependencies: string[];
	libraryDependencies: string[];
	sourceBranch: string;
	authors: string;
	libraryMajorVersion: number;
	libraryMinorVersion: number;
	typeScriptVersion: TypeScriptVersion;
	files: string[];
	hasPackageJson: boolean;
	contentHash: string;

	directoryPath(options: Options): string {
		return definitelyTypedPath(this.typingsPackageName, options);
	}

	filePath(fileName: string, options: Options): string {
		return path.join(this.directoryPath(options), fileName);
	}
}

function readTypesDataFile(): Promise<any> {
	return readDataFile("parse-definitions", typesDataFilename);
}

function notNeededPackagesPath(options: Options) {
	return path.join(options.definitelyTypedPath, "notNeededPackages.json");
}

async function readNotNeededPackages(options: Options): Promise<NotNeededPackageRaw[]> {
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

export function definitelyTypedPath(dirName: string, options: Options): string {
	return path.join(options.definitelyTypedPath, dirName);
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
