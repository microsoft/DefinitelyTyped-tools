import assert = require("assert");
import { Author, TypeScriptVersion, AllTypeScriptVersion } from "definitelytyped-header-parser";

import { FS } from "../get-definitely-typed";
import { assertSorted, joinPaths, mapValues, unmangleScopedPackage } from "../util/util";

import { readDataFile } from "./common";
import { outputDirPath, orgName, scopeName } from "./settings";
import { Semver } from "./versions";

export class AllPackages {
    static async read(dt: FS): Promise<AllPackages> {
        return AllPackages.from(await readTypesDataFile(), readNotNeededPackages(dt));
    }

    static from(data: TypesDataFile, notNeeded: ReadonlyArray<NotNeededPackage>): AllPackages {
        return new AllPackages(mapValues(new Map(Object.entries(data)), raw => new TypingsVersions(raw)), notNeeded);
    }

    static async readTypings(): Promise<ReadonlyArray<TypingsData>> {
        return AllPackages.from(await readTypesDataFile(), []).allTypings();
    }
    static async readLatestTypings(): Promise<ReadonlyArray<TypingsData>> {
        return AllPackages.from(await readTypesDataFile(), []).allLatestTypings();
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

    static readSingleNotNeeded(name: string, dt: FS): NotNeededPackage {
        const notNeeded = readNotNeededPackages(dt);
        const pkg = notNeeded.find(p => p.name === name);
        if (pkg === undefined) {
            throw new Error(`Cannot find not-needed package ${name}`);
        }
        return pkg;
    }

    private constructor(
        private readonly data: ReadonlyMap<string, TypingsVersions>,
        private readonly notNeeded: ReadonlyArray<NotNeededPackage>) {}

    getNotNeededPackage(name: string): NotNeededPackage | undefined {
        return this.notNeeded.find(p => p.name === name);
    }

    hasTypingFor(dep: PackageId): boolean {
        return this.tryGetTypingsData(dep) !== undefined;
    }

    tryResolve(dep: PackageId): PackageId {
        const versions = this.data.get(getMangledNameForScopedPackage(dep.name));
        return versions ? versions.get(dep.majorVersion).id : dep;
    }

    /** Gets the latest version of a package. E.g. getLatest(node v6) was node v10 (before node v11 came out). */
    getLatest(pkg: TypingsData): TypingsData {
        return pkg.isLatest ? pkg : this.getLatestVersion(pkg.name);
    }

    private getLatestVersion(packageName: string): TypingsData {
        const latest = this.tryGetLatestVersion(packageName);
        if (!latest) {
            throw new Error(`No such package ${packageName}.`);
        }
        return latest;
    }

    tryGetLatestVersion(packageName: string): TypingsData | undefined {
        const versions = this.data.get(getMangledNameForScopedPackage(packageName));
        return versions && versions.getLatest();
    }

    getTypingsData(id: PackageId): TypingsData {
        const pkg = this.tryGetTypingsData(id);
        if (!pkg) {
            throw new Error(`No typings available for ${JSON.stringify(id)}`);
        }
        return pkg;
    }

    tryGetTypingsData({ name, majorVersion }: PackageId): TypingsData | undefined {
        const versions = this.data.get(getMangledNameForScopedPackage(name));
        return versions && versions.tryGet(majorVersion);
    }

    allPackages(): ReadonlyArray<AnyPackage> {
        return [ ...this.allTypings(), ...this.allNotNeeded() ];
    }

    /** Note: this includes older version directories (`foo/v0`) */
    allTypings(): ReadonlyArray<TypingsData> {
        return assertSorted(Array.from(flattenData(this.data)), t => t.name);
    }

    allLatestTypings(): ReadonlyArray<TypingsData> {
        return assertSorted(Array.from(this.data.values()).map(versions => versions.getLatest()), t => t.name);
    }

    allNotNeeded(): ReadonlyArray<NotNeededPackage> {
        return this.notNeeded;
    }

    /** Returns all of the dependences *that have typings*, ignoring others, and including test dependencies. */
    *allDependencyTypings(pkg: TypingsData): Iterable<TypingsData> {
        for (const { name, majorVersion } of pkg.dependencies) {
            const versions = this.data.get(getMangledNameForScopedPackage(name));
            if (versions) {
                yield versions.get(majorVersion);
            }
        }

        for (const name of pkg.testDependencies) {
            const versions = this.data.get(getMangledNameForScopedPackage(name));
            if (versions) {
                yield versions.getLatest();
            }
        }
    }
}

// Same as the function in moduleNameResolver.ts in typescript
export function getMangledNameForScopedPackage(packageName: string): string {
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
}

/** Prefer to use `AnyPackage` instead of this. */
export abstract class PackageBase {
    static compare(a: PackageBase, b: PackageBase): number { return a.name.localeCompare(b.name); }

    /** Note: for "foo__bar" this is still "foo__bar", not "@foo/bar". */
    readonly name: string;
    readonly libraryName: string;

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
    }

    isNotNeeded(): this is NotNeededPackage {
        return this instanceof NotNeededPackage;
    }

    abstract readonly isLatest: boolean;
    abstract readonly projectName: string;
    abstract readonly declaredModules: ReadonlyArray<string>;
    abstract readonly globals: ReadonlyArray<string>;
    abstract readonly minTypeScriptVersion: TypeScriptVersion;

    /** '@types/foo' for a package 'foo'. */
    get fullNpmName(): string {
        return getFullNpmName(this.name);
    }

    /** '@definitelytyped/foo' for a package 'foo'. */
    get fullGithubName(): string {
        return getFullGithubName(this.name);
    }

    /** '@types%2ffoo' for a package 'foo'. */
    get fullEscapedNpmName(): string {
        return `@${scopeName}%2f${this.name}`;
    }

    /** '@definitelytyped%2ffoo' for a package 'foo'. */
    get fullEscapedGithubName(): string {
        return `@${orgName}%2f${this.name}`;
    }

    abstract readonly major: number;

    get id(): PackageId {
        return { name: this.name, majorVersion: this.major };
    }

    get outputDirectory(): string {
        return joinPaths(outputDirPath, this.desc);
    }
}

export function getFullGithubName(packageName: string): string {
    return `@${orgName}/${getMangledNameForScopedPackage(packageName)}`;
}

export function getFullNpmName(packageName: string): string {
    return `@${scopeName}/${getMangledNameForScopedPackage(packageName)}`;
}

interface NotNeededPackageRaw extends BaseRaw {
    /**
     * If this is available, @types typings are deprecated as of this version.
     * This is useful for packages that previously had DefinitelyTyped definitions but which now provide their own.
     */
    // This must be "major.minor.patch"
    readonly asOfVersion: string;
    /** The package's own url, *not* DefinitelyTyped's. */
    readonly sourceRepoURL: string;
}

export class NotNeededPackage extends PackageBase {
    readonly version: Semver;

    get license(): License.MIT { return License.MIT; }

    readonly sourceRepoURL: string;

    constructor(raw: NotNeededPackageRaw) {
        super(raw);
        this.sourceRepoURL = raw.sourceRepoURL;

        for (const key in raw) {
            if (!["libraryName", "typingsPackageName", "sourceRepoURL", "asOfVersion"].includes(key)) {
                throw new Error(`Unexpected key in not-needed package: ${key}`);
            }
        }
        assert(raw.libraryName && raw.typingsPackageName && raw.sourceRepoURL && raw.asOfVersion);

        this.version = Semver.parse(raw.asOfVersion);
    }

    get major(): number { return this.version.major; }
    get minor(): number { return this.version.minor; }

    // A not-needed package has no other versions. (TODO: allow that?)
    get isLatest(): boolean { return true; }
    get projectName(): string { return this.sourceRepoURL; }
    get declaredModules(): ReadonlyArray<string> { return []; }
    get globals(): ReadonlyArray<string> { return this.globals; }
    get minTypeScriptVersion(): TypeScriptVersion { return TypeScriptVersion.lowest; }

    readme(): string {
        return `This is a stub types definition for ${this.libraryName} (${this.sourceRepoURL}).\n
${this.libraryName} provides its own type definitions, so you don't need ${getFullNpmName(this.name)} installed!`;
    }

    deprecatedMessage(): string {
        return `This is a stub types definition. ${this.name} provides its own type definitions, so you do not need this installed.`;
    }
}

export interface TypingsVersionsRaw {
    [version: string]: TypingsDataRaw;
}

/** If no version is specified, uses "*". */
export type DependencyVersion = number | "*";

export interface PackageJsonDependency {
    readonly name: string;
    readonly version: string;
}

export interface TypingsDataRaw extends BaseRaw {
    readonly dependencies: ReadonlyArray<PackageId>;
    // These are always the latest version.
    // Will not include anything already in `dependencies`.
    readonly testDependencies: ReadonlyArray<string>;
    readonly pathMappings: ReadonlyArray<PathMapping>;

    // Parsed from "Definitions by:"
    readonly contributors: ReadonlyArray<Author>;

    // The major version of the library (e.g. "1" for 1.0, "2" for 2.0)
    readonly libraryMajorVersion: number;
    // The minor version of the library
    readonly libraryMinorVersion: number;

    readonly minTsVersion: AllTypeScriptVersion;
    /**
     * List of TS versions that have their own directories, and corresponding "typesVersions" in package.json.
     * Usually empty.
     */
    readonly typesVersions: ReadonlyArray<TypeScriptVersion>;

    // Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
    // Does *not* include a partial `package.json` because that will not be copied directly.
    readonly files: ReadonlyArray<string>;

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

/**
 * Represents that there was a path mapping to a package.
 * Not all path mappings are direct dependencies: They may be necessary for dependencies-of-dependencies.
 * But, where dependencies and pathMappings share a key, they must share the same value
 */
export interface PathMapping {
    readonly packageName: string;
    readonly majorVersion: number;
}

// TODO: support BSD -- but must choose a *particular* BSD license from the list at https://spdx.org/licenses/
export const enum License { MIT = "MIT", Apache20 = "Apache-2.0" }
const allLicenses = [License.MIT, License.Apache20];
export function getLicenseFromPackageJson(packageJsonLicense: unknown): License {
    if (packageJsonLicense === undefined) { // tslint:disable-line strict-type-predicates (false positive)
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

    /**
     * Values are reversed so that we publish the current version first.
     * This is important because older versions repeatedly reset the "latest" tag to the current version.
     */
    getAll(): Iterable<TypingsData> {
        return Array.from(this.map.values()).reverse();
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

export class TypingsData extends PackageBase {
    constructor(private readonly data: TypingsDataRaw, readonly isLatest: boolean) {
        super(data);
    }

    get testDependencies(): ReadonlyArray<string> { return this.data.testDependencies; }
    get contributors(): ReadonlyArray<Author> { return this.data.contributors; }
    get major(): number { return this.data.libraryMajorVersion; }
    get minor(): number { return this.data.libraryMinorVersion; }

    get minTypeScriptVersion(): TypeScriptVersion {
        return TypeScriptVersion.isSupported(this.data.minTsVersion) ? this.data.minTsVersion : TypeScriptVersion.lowest;
    }
    get typesVersions(): ReadonlyArray<TypeScriptVersion> { return this.data.typesVersions; }

    get files(): ReadonlyArray<string> { return this.data.files; }
    get license(): License { return this.data.license; }
    get packageJsonDependencies(): ReadonlyArray<PackageJsonDependency> { return this.data.packageJsonDependencies; }
    get contentHash(): string { return this.data.contentHash; }
    get declaredModules(): ReadonlyArray<string> { return this.data.declaredModules; }
    get projectName(): string { return this.data.projectName; }
    get globals(): ReadonlyArray<string> { return this.data.globals; }
    get pathMappings(): ReadonlyArray<PathMapping> { return this.data.pathMappings; }

    get dependencies(): ReadonlyArray<PackageId> {
        return this.data.dependencies;
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

export interface TypesDataFile {
    readonly [packageName: string]: TypingsVersionsRaw;
}
function readTypesDataFile(): Promise<TypesDataFile> {
    return readDataFile("parse-definitions", typesDataFilename) as Promise<TypesDataFile>;
}

export function readNotNeededPackages(dt: FS): ReadonlyArray<NotNeededPackage> {
    const rawJson = dt.readJson("notNeededPackages.json"); // tslint:disable-line await-promise (tslint bug)
    return (rawJson as { readonly packages: ReadonlyArray<NotNeededPackageRaw> }).packages.map(raw => new NotNeededPackage(raw));
}
