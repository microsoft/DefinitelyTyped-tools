import assert = require("assert");
import { Author, TypeScriptVersion } from "definitelytyped-header-parser";

import { FS } from "../get-definitely-typed";
import { joinPaths, mapValues, unmangleScopedPackage } from "../util/util";

import { home, readDataFile } from "./common";
import { outputPath, scopeName } from "./settings";
import { Semver } from "./versions";

export class AllPackages {
	static async read(dt: FS): Promise<AllPackages> {
		return AllPackages.from(await readTypesDataFile(), await readNotNeededPackages(dt));
	}

	static from(data: TypesDataFile, notNeeded: ReadonlyArray<NotNeededPackage>): AllPackages {
		return new AllPackages(mapValues(new Map(Object.entries(data)), raw => new TypingsVersions(raw)), notNeeded);
	}

	static async readTypings(): Promise<ReadonlyArray<TypingsData>> {
		return AllPackages.from(await readTypesDataFile(), []).allTypings();
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

	static async readSingleNotNeeded(name: string, dt: FS): Promise<NotNeededPackage> {
		const notNeeded = await readNotNeededPackages(dt);
		const pkg = notNeeded.find(p => p.name === name);
		if (pkg === undefined) {
			throw new Error(`Cannot find not-needed package ${name}`);
		}
		return pkg;
	}

	private constructor(
		private readonly data: ReadonlyMap<string, TypingsVersions>,
		private readonly notNeeded: ReadonlyArray<NotNeededPackage>) {}

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

	getTypingsData(id: PackageId): TypingsData {
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

	allPackages(): ReadonlyArray<AnyPackage> {
		return [ ...this.allTypings(), ...this.allNotNeeded() ];
	}

	allTypings(): ReadonlyArray<TypingsData> {
		return Array.from(flattenData(this.data));
	}

	allLatestTypings(): ReadonlyArray<TypingsData> {
		return Array.from(this.data.values()).map(versions => versions.getLatest());
	}

	allNotNeeded(): ReadonlyArray<NotNeededPackage> {
		return this.notNeeded;
	}

	/** Returns all of the dependences *that have typings*, ignoring others. */
	*dependencyTypings(pkg: TypingsData): Iterable<TypingsData> {
		for (const { name, majorVersion } of pkg.dependencies) {
			const versions = this.data.get(getMangledNameForScopedPackage(name));
			if (versions) {
				yield versions.get(majorVersion);
			}
		}
	}

	/** Like 'dependencyTypings', but includes test dependencies. */
	*allDependencyTypings(pkg: TypingsData): Iterable<TypingsData> {
		yield* this.dependencyTypings(pkg);

		for (const name of pkg.testDependencies) {
			const versions = this.data.get(getMangledNameForScopedPackage(name));
			if (versions) {
				yield versions.getLatest();
			}
		}
	}
}

// Same as the function in moduleNameResolver.ts in typescript
function getMangledNameForScopedPackage(packageName: string): string {
	if (packageName.startsWith("@")) {
		const replaceSlash = packageName.replace("/", "__");
		if (replaceSlash !== packageName) {
			return replaceSlash.slice(1); // Take off the "@"
		}
	}
	return packageName;
}

export const typesDataFilename = "definitions.json";

function* flattenData(data: ReadonlyMap<string, TypingsVersions>): Iterable<TypingsData> {
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
	static compare(a: PackageBase, b: PackageBase): number { return a.name.localeCompare(b.name); }

	/** Note: for "foo__bar" this is still "foo__bar", not "@foo/bar". */
	readonly name: string;
	readonly libraryName: string;
	readonly sourceRepoURL: string;

	get unescapedName(): string {
		return unmangleScopedPackage(this.name) || this.name;
	}

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
	abstract readonly declaredModules: ReadonlyArray<string>;
	abstract readonly globals: ReadonlyArray<string>;
	abstract readonly typeScriptVersion: TypeScriptVersion;

	/** '@types/foo' for a package 'foo'. */
	get fullNpmName(): string {
		return fullNpmName(this.name);
	}

	/** '@types%2ffoo' for a package 'foo'. */
	get fullEscapedNpmName(): string {
		return `@${scopeName}%2f${this.name}`;
	}

	abstract readonly major: number;

	get id(): PackageId {
		return { name: this.name, majorVersion: this.major };
	}

	get outputDirectory(): string {
		return joinPaths(outputDir, this.desc);
	}
}

export function fullNpmName(packageName: string): string {
	return `@${scopeName}/${packageName}`;
}

export const outputDir = joinPaths(home, outputPath);

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

	get license(): License.MIT { return License.MIT; }

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
	get isLatest(): boolean { return true; }
	get isPrerelease(): boolean { return false; }
	get projectName(): string { return this.sourceRepoURL; }
	get declaredModules(): ReadonlyArray<string> { return []; }
	get globals(): ReadonlyArray<string> { return this.globals; }
	get typeScriptVersion(): TypeScriptVersion { return TypeScriptVersion.lowest; }

	readme(): string {
		return `This is a stub types definition for ${this.libraryName} (${this.sourceRepoURL}).\n
${this.libraryName} provides its own type definitions, so you don't need ${fullNpmName(this.name)} installed!`;
	}

	deprecatedMessage(): string {
		return `This is a stub types definition. ${this.name} provides its own type definitions, so you do not need this installed.`;
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

export interface PackageJsonDependency {
	readonly name: string;
	readonly version: string;
}

export interface TypingsDataRaw extends BaseRaw {
	readonly dependencies: DependenciesRaw;
	// These are always the latest version.
	// Will not include anything already in `dependencies`.
	readonly testDependencies: ReadonlyArray<string>;
	readonly pathMappings: PathMappingsRaw;

	// Parsed from "Definitions by:"
	readonly contributors: ReadonlyArray<Author>;

	// The major version of the library (e.g. "1" for 1.0, "2" for 2.0)
	readonly libraryMajorVersion: number;
	// The minor version of the library
	readonly libraryMinorVersion: number;

	readonly typeScriptVersion: TypeScriptVersion;

	// Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
	// Does *not* include a partial `package.json` because that will not be copied directly.
	readonly files: ReadonlyArray<string>;

	// List of all test files.
	readonly testFiles: ReadonlyArray<string>;

	// Whether a "package.json" exists
	readonly license: License;
	readonly packageJsonDependencies: ReadonlyArray<PackageJsonDependency>;

	// A hash computed from all files from this definition
	readonly contentHash: string;

	// Optionally-present name or URL of the project, e.g. "http://cordova.apache.org"
	readonly projectName: string;

	// Names introduced into the global scope by this definition set
	readonly globals: ReadonlyArray<string>;

	// External modules declared by this package. Includes the containing folder name when applicable (e.g. proper module)
	readonly declaredModules: ReadonlyArray<string>;
}

// TODO: support BSD -- but must choose a *particular* BSD license from the list at https://spdx.org/licenses/
export const enum License { MIT = "MIT", Apache20 = "Apache-2.0" }
const allLicenses = [License.MIT, License.Apache20];
export function getLicenseFromPackageJson(packageJsonLicense: {} | null | undefined): License {
	if (packageJsonLicense === undefined) {
		return License.MIT;
	}
	if (packageJsonLicense === "MIT") {
		throw new Error(`Specifying '"license": "MIT"' is redundant, this is the default.`);
	}
	if (allLicenses.includes(packageJsonLicense as License)) {
		return packageJsonLicense as License;
	}
	throw new Error(`'package.json' license is ${JSON.stringify(packageJsonLicense)}.\nExpected one of: ${JSON.stringify(allLicenses)}}`);
}

class TypingsVersions {
	private readonly map: ReadonlyMap<number, TypingsData>;
	private readonly latest: number;

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

export class TypingsData extends PackageBase {
	constructor(private readonly data: TypingsDataRaw, readonly isLatest: boolean) {
		super(data);
	}

	get testDependencies(): ReadonlyArray<string> { return this.data.testDependencies; }
	get contributors(): ReadonlyArray<Author> { return this.data.contributors; }
	get major(): number { return this.data.libraryMajorVersion; }
	get minor(): number { return this.data.libraryMinorVersion; }
	get majorMinor(): MajorMinor { return { major: this.major, minor: this.minor }; }
	get typeScriptVersion(): TypeScriptVersion { return this.data.typeScriptVersion; }
	get files(): ReadonlyArray<string> { return this.data.files; }
	get testFiles(): ReadonlyArray<string> { return this.data.testFiles; }
	get license(): License { return this.data.license; }
	get packageJsonDependencies(): ReadonlyArray<PackageJsonDependency> { return this.data.packageJsonDependencies; }
	get contentHash(): string { return this.data.contentHash; }
	get declaredModules(): ReadonlyArray<string> { return this.data.declaredModules; }
	get projectName(): string { return this.data.projectName; }
	get globals(): ReadonlyArray<string> { return this.data.globals; }
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
	return readDataFile("parse-definitions", typesDataFilename) as Promise<TypesDataFile>;
}

export async function readNotNeededPackages(dt: FS): Promise<ReadonlyArray<NotNeededPackage>> {
	const rawJson = await dt.readJson("notNeededPackages.json"); // tslint:disable-line await-promise (tslint bug)
	return (rawJson as { readonly packages: ReadonlyArray<NotNeededPackageRaw> }).packages.map(raw => new NotNeededPackage(raw));
}
