import assert = require("assert");

import { readJson } from "../util/io";
import { joinPaths, mapValues } from "../util/util";

import { Options, home, readDataFile } from "./common";
import { scopeName, outputPath } from "./settings";
import { Semver } from "./versions";

export class AllPackages {
	static async read(options: Options): Promise<AllPackages> {
		const map = await readData();
		const notNeeded = (await readNotNeededPackages(options)).map(raw => new NotNeededPackage(raw));
		return new AllPackages(map, notNeeded);
	}

	static async readTypings(): Promise<TypingsData[]> {
		return Array.from(flattenData(await readData()));
	}

	/** Use for `--single` tasks only. Do *not* call this in a loop! */
	static async readSingle(name: string): Promise<TypingsData> {
		const data = await readTypesDataFile();
		const raw = data[name];
		if (!raw) {
			throw new Error(`Can't find package ${name}`);
		}
		const versions = Object.keys(raw);
		if (versions.length > 1) {
			throw new Error(`Package ${name} has multiple versions.`);
		}
		return new TypingsData(raw[versions[0]], /*isLatest*/ true);
	}

	private constructor(
		private readonly data: Map<string, TypingsVersions>,
		private readonly notNeeded: NotNeededPackage[]) {}

	getAnyPackage(id: PackageId): AnyPackage {
		const pkg: AnyPackage | undefined = this.tryGetTypingsData(id) || this.notNeeded.find(p => p.name === id.name);
		if (!pkg) {
			throw new Error(`Expected to find a package named ${id.name}`);
		}
		return pkg;
	}

	hasTypingFor(dep: PackageId): boolean {
		return this.tryGetTypingsData(dep) !== undefined;
	}

	/** Gets the latest version of a package. E.g. getLatest(node v6) = node v7. */
	getLatest(pkg: AnyPackage): AnyPackage {
		return pkg.isNotNeeded() ? pkg : this.getLatestVersion(pkg.name);
	}

	/** Use only with `--single` tasks. */
	getSingle(packageName: string): TypingsData {
		return this.getLatestVersion(packageName);
	}

	private getLatestVersion(packageName: string): TypingsData {
		const latest = this.tryGetLatestVersion(packageName);
		if (!latest) {
			throw new Error(`No such package ${packageName}.`);
		}
		return latest;
	}

	tryGetLatestVersion(packageName: string): TypingsData | undefined {
		const versions = this.data.get(packageName);
		return versions && versions.getLatest();
	}

	getTypingsData(id: PackageId) {
		const pkg = this.tryGetTypingsData(id);
		if (!pkg) {
			throw new Error(`No typings available for ${id}`);
		}
		return pkg;
	}

	tryGetTypingsData({ name, majorVersion }: PackageId): TypingsData | undefined {
		const versions = this.data.get(name);
		return versions && versions.tryGet(majorVersion);
	}

	allPackages(): AnyPackage[] {
		return (this.allTypings() as AnyPackage[]).concat(this.allNotNeeded());
	}

	allTypings(): TypingsData[] {
		return Array.from(flattenData(this.data));
	}

	allNotNeeded(): NotNeededPackage[] {
		return this.notNeeded;
	}

	/** Returns all of the dependences *that have typings*, ignoring others. */
	*dependencyTypings(pkg: TypingsData): Iterable<TypingsData> {
		for (const { name, majorVersion } of pkg.dependencies) {
			const versions = this.data.get(name);
			if (versions) {
				yield versions.get(majorVersion);
			}
		}
	}

	/** Like 'dependencyTypings', but includes test dependencies. */
	*allDependencyTypings(pkg: TypingsData): Iterable<TypingsData> {
		yield* this.dependencyTypings(pkg);

		for (const name of pkg.testDependencies) {
			const versions = this.data.get(name);
			if (versions) {
				yield versions.getLatest();
			}
		}
	}
}

export const typesDataFilename = "definitions.json";

async function readData(): Promise<Map<string, TypingsVersions>> {
	const data = await readTypesDataFile();
	return mapValues(new Map(Object.entries(data)), raw => new TypingsVersions(raw));
}

function* flattenData(data: Map<string, TypingsVersions>): Iterable<TypingsData> {
	for (const versions of data.values()) {
		yield* versions.getAll();
	}
}

export type AnyPackage = NotNeededPackage | TypingsData;

interface BaseRaw {
	// The name of the library (human readable, e.g. might be "Moment.js" even though packageName is "moment")
	readonly libraryName: string;

	// The NPM name to publish this under, e.g. "jquery". Does not include "@types".
	readonly typingsPackageName: string;

	// e.g. https://github.com/DefinitelyTyped
	readonly sourceRepoURL: string;
}

/** Prefer to use `AnyPackage` instead of this. */
export abstract class PackageBase {
	static compare(a: PackageBase, b: PackageBase) { return a.name.localeCompare(b.name); }

	readonly name: string;
	readonly libraryName: string;
	readonly sourceRepoURL: string;

	/** Short description for debug output. */
	get desc(): string {
		return this.isLatest ? this.name : `${this.name} v${this.major}`;
	}

	constructor(data: BaseRaw) {
		this.name = data.typingsPackageName;
		this.libraryName = data.libraryName;
		this.sourceRepoURL = data.sourceRepoURL;
	}

	isNotNeeded(): this is NotNeededPackage {
		return this instanceof NotNeededPackage;
	}

	abstract readonly isLatest: boolean;
	abstract readonly isPrerelease: boolean;
	abstract readonly projectName: string;
	abstract readonly declaredModules: string[];
	abstract readonly globals: string[];
	abstract readonly typeScriptVersion: TypeScriptVersion;

	/** '@types/foo' for a package 'foo'. */
	get fullNpmName(): string {
		return fullNpmName(this.name);
	}

	/** '@types%2ffoo' for a package 'foo'. */
	get fullEscapedNpmName() {
		return `@${scopeName}%2f${this.name}`;
	}

	abstract readonly major: number;

	get id(): PackageId {
		return { name: this.name, majorVersion: this.major };
	}

	get outputDirectory() {
		return joinPaths(outputDir, this.desc);
	}
}

export function fullNpmName(packageName: string) {
	return `@${scopeName}/${packageName}`;
}

const outputDir = joinPaths(home, outputPath);

interface NotNeededPackageRaw extends BaseRaw {
	/**
	 * If this is available, @types typings are deprecated as of this version.
	 * This is useful for packages that previously had DefinitelyTyped definitions but which now provide their own.
	 */
	// This must be "major.minor.patch"
	readonly asOfVersion: string;
}

export class NotNeededPackage extends PackageBase {
	readonly version: Semver;

	constructor(raw: NotNeededPackageRaw) {
		super(raw);

		for (const key in raw) {
			if (!["libraryName", "typingsPackageName", "sourceRepoURL", "asOfVersion"].includes(key)) {
				throw new Error(`Unexpected key in not-needed package: ${key}`);
			}
		}
		assert(raw.libraryName && raw.typingsPackageName && raw.sourceRepoURL && raw.asOfVersion);

		this.version = Semver.parse(raw.asOfVersion, /*isPrerelease*/ false);
	}

	get major(): number { return this.version.major; }
	get minor(): number { return this.version.minor; }

	// A not-needed package has no other versions. (TODO: allow that?)
	get isLatest() { return true; }
	get isPrerelease() { return false; }
	get projectName(): string { return this.sourceRepoURL; }
	get declaredModules(): string[] { return []; }
	get globals(): string[] { return this.globals; }
	get typeScriptVersion(): TypeScriptVersion { return TypeScriptVersion.Lowest; }

	readme(useNewline = true): string {
		const { libraryName, sourceRepoURL, name } = this;
		const lines = [
			`This is a stub types definition for ${libraryName} (${sourceRepoURL}).`,
			`${libraryName} provides its own type definitions, so you don't need ${fullNpmName(name)} installed!`
		];
		return lines.join(useNewline ? "\n" : " ");
	}
}

export interface TypingsVersionsRaw {
	[version: string]: TypingsDataRaw;
}

/**
 * Maps The name of a package to the major version number.
 * Does not include `@types` in the package name. It may also be a dependency on a non-@types package.
 */
export interface DependenciesRaw {
	[packageName: string]: DependencyVersion;
}
/**
 * Maps that name of a package to a major version number from a path mapping.
 * Not all path mappings are direct dependencies: They may be necessary for dependencies-of-dependencies.
 * But, where dependencies and pathMappings share a key, they must share the same value.
 */
export interface PathMappingsRaw {
	[packageName: string]: number;
}

/** If no version is specified, uses "*". */
export type DependencyVersion = number | "*";

export interface TypingsDataRaw extends BaseRaw {
	readonly dependencies: DependenciesRaw;
	 // These are always the latest version.
	 // Will not include anything already in `dependencies`.
	readonly testDependencies: string[];
	readonly pathMappings: PathMappingsRaw;

	// Parsed from "Definitions by:"
	readonly contributors: Contributor[];

	// The major version of the library (e.g. "1" for 1.0, "2" for 2.0)
	readonly libraryMajorVersion: number;
	// The minor version of the library
	readonly libraryMinorVersion: number;

	readonly typeScriptVersion: TypeScriptVersion;

	// Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
	// Does *not* include a partial `package.json` because that will not be copied directly.
	readonly files: string[];

	// List of all test files.
	readonly testFiles: string[];

	// Whether a "package.json" exists
	readonly hasPackageJson: boolean;

	// A hash computed from all files from this definition
	readonly contentHash: string;

	// Optionally-present name or URL of the project, e.g. "http://cordova.apache.org"
	readonly projectName: string;

	// Names introduced into the global scope by this definition set
	readonly globals: string[];

	// External modules declared by this package. Includes the containing folder name when applicable (e.g. proper module)
	readonly declaredModules: string[];
}

class TypingsVersions {
	private map: Map<number, TypingsData>;
	private latest: number;

	constructor(data: TypingsVersionsRaw) {
		const versions = Object.keys(data).map(Number);
		this.latest = Math.max(...versions);
		this.map = new Map(versions.map((version): [number, TypingsData] =>
			[version, new TypingsData(data[version], version === this.latest)]));
	}

	getAll(): Iterable<TypingsData> {
		return this.map.values();
	}

	get(majorVersion: DependencyVersion): TypingsData {
		return majorVersion === "*" ? this.getLatest() : this.getExact(majorVersion);
	}

	tryGet(majorVersion: DependencyVersion): TypingsData | undefined {
		return majorVersion === "*" ? this.getLatest() : this.tryGetExact(majorVersion);
	}

	getLatest(): TypingsData {
		return this.getExact(this.latest);
	}

	private getExact(majorVersion: number): TypingsData {
		const data = this.tryGetExact(majorVersion);
		if (!data) {
			throw new Error(`Could not find version ${majorVersion}`);
		}
		return data;
	}

	private tryGetExact(majorVersion: number): TypingsData | undefined {
		return this.map.get(majorVersion);
	}
}

export interface MajorMinor {
	readonly major: number;
	readonly minor: number;
}

export interface Contributor {
	name: string;
	url: string;
}

export class TypingsData extends PackageBase {
	constructor(private readonly data: TypingsDataRaw, readonly isLatest: boolean) {
		super(data);
	}

	get testDependencies(): string[] { return this.data.testDependencies; }
	get contributors(): Contributor[] { return this.data.contributors; }
	get major(): number { return this.data.libraryMajorVersion; }
	get minor(): number { return this.data.libraryMinorVersion; }
	get majorMinor(): MajorMinor { return { major: this.major, minor: this.minor }; }
	get typeScriptVersion(): TypeScriptVersion { return this.data.typeScriptVersion; }
	get files(): string[] { return this.data.files; }
	get testFiles(): string[] { return this.data.testFiles; }
	get hasPackageJson(): boolean { return this.data.hasPackageJson; }
	get contentHash(): string { return this.data.contentHash; }
	get declaredModules(): string[] { return this.data.declaredModules; }
	get projectName(): string { return this.data.projectName; }
	get globals(): string[] { return this.data.globals; }
	get pathMappings(): Iterable<[string, number]> {
		return Object.entries(this.data.pathMappings);
	}

	get isPrerelease(): boolean {
		return TypeScriptVersion.isPrerelease(this.typeScriptVersion);
	}

	get dependencies(): Iterable<PackageId> {
		return this.deps();
	}

	private *deps(): Iterable<PackageId> {
		const raw = this.data.dependencies;
		for (const name in raw) {
			yield { name, majorVersion: raw[name] };
		}
	}

	/** Path to this package, *relative* to the DefinitelyTyped directory. */
	get subDirectoryPath(): string {
		return this.isLatest ? this.name : `${this.name}/v${this.data.libraryMajorVersion}`;
	}

	directoryPath(options: Options): string {
		return joinPaths(options.definitelyTypedPath, this.subDirectoryPath);
	}

	filePath(fileName: string, options: Options): string {
		return joinPaths(this.directoryPath(options), fileName);
	}
}

/** Uniquely identifies a package. */
export interface PackageId {
	readonly name: string;
	readonly majorVersion: DependencyVersion;
}

interface TypesDataFile {
	readonly [packageName: string]: TypingsVersionsRaw;
}
function readTypesDataFile(): Promise<TypesDataFile> {
	return readDataFile("parse-definitions", typesDataFilename);
}

function notNeededPackagesPath(options: Options) {
	return joinPaths(options.definitelyTypedPath, "notNeededPackages.json");
}

async function readNotNeededPackages(options: Options): Promise<NotNeededPackageRaw[]> {
	return (await readJson(notNeededPackagesPath(options))).packages;
}

/** Path to the *root* for a given package. Path to a particular version may differ. */
export function packageRootPath(packageName: string, options: Options): string {
	return joinPaths(options.definitelyTypedPath, packageName);
}

export type TypeScriptVersion = "2.0" | "2.1";
export namespace TypeScriptVersion {
	export const All: TypeScriptVersion[] = ["2.0", "2.1"];
	export const Lowest = "2.0";
	/** Latest version that may be specified in a `// TypeScript Version:` header. */
	export const Latest = "2.1";

	/** True if a package with the given typescript version should be published as prerelease. */
	export function isPrerelease(_version: TypeScriptVersion): boolean {
		return false;
	}

	/** List of NPM tags that should be changed to point to the latest version. */
	export function tagsToUpdate(typeScriptVersion: TypeScriptVersion): string[]  {
		switch (typeScriptVersion) {
			case "2.0":
				// A 2.0-compatible package is assumed compatible with TypeScript 2.1
				// We want the "2.1" tag to always exist.
				return [tags.latest, tags.v2_0, tags.v2_1, tags.v2_2, tags.v2_3];
			case "2.1":
				return [tags.latest, tags.v2_1, tags.v2_2, tags.v2_3];
		}
	}

	namespace tags {
		export const latest = "latest";
		export const v2_0 = "ts2.0";
		export const v2_1 = "ts2.1";
		export const v2_2 = "ts2.2";
		export const v2_3 = "ts2.3";
	}
}
