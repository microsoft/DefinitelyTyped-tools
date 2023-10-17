import assert = require("assert");
import { Contributor, Header, License } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { FS, assertDefined, assertSorted, mapValues, unique, unmangleScopedPackage } from "@definitelytyped/utils";
import * as semver from "semver";
import { readDataFile } from "./data-file";
import { parseVersionFromDirectoryName } from "./lib/definition-parser";
import { scopeName, typesDirectoryName } from "./lib/settings";
import { slicePrefixes } from "./lib/utils";

export class AllPackages {
  static async read(dt: FS): Promise<AllPackages> {
    return AllPackages.from(await readTypesDataFile(), readNotNeededPackages(dt));
  }

  static from(data: TypesDataFile, notNeeded: readonly NotNeededPackage[]): AllPackages {
    return new AllPackages(
      mapValues(new Map(Object.entries(data)), (raw) => new TypingsVersions(raw)),
      notNeeded
    );
  }

  static async readTypings(): Promise<readonly TypingsData[]> {
    return AllPackages.from(await readTypesDataFile(), []).allTypings();
  }
  static async readLatestTypings(): Promise<readonly TypingsData[]> {
    return AllPackages.from(await readTypesDataFile(), []).allLatestTypings();
  }

  /** Use for `--single` tasks only. Do *not* call this in a loop! */
  static async readSingle(name: string): Promise<TypingsData> {
    const data = await readTypesDataFile();
    const raw = data[name];
    if (!raw) {
      throw new Error(`Can't find package ${name}`);
    }
    const versions = Object.values(raw);
    if (versions.length > 1) {
      throw new Error(`Package ${name} has multiple versions.`);
    }
    return new TypingsData(versions[0], /*isLatest*/ true);
  }

  private constructor(
    /** Keys are `typesDirectoryName` strings */
    private readonly data: ReadonlyMap<string, TypingsVersions>,
    private readonly notNeeded: readonly NotNeededPackage[]
  ) {}

  getNotNeededPackage(typesDirectoryName: string): NotNeededPackage | undefined {
    return this.notNeeded.find((p) => p.typesDirectoryName === typesDirectoryName);
  }

  hasTypingFor(dep: PackageId): boolean {
    return this.tryGetTypingsData(dep) !== undefined;
  }

  /**
   * Whether a package maintains multiple minor versions of typings simultaneously by
   * using minor-versioned directories like 'react-native/v14.1'
   */
  hasSeparateMinorVersions(typesDirectoryName: string) {
    const versions = Array.from(assertDefined(this.data.get(typesDirectoryName)).getAll());
    const minors = versions.map((v) => v.minor);
    return minors.length !== unique(minors).length;
  }

  tryResolve(dep: PackageId): PackageId {
    const typesDirectoryName = dep.typesDirectoryName ?? dep.name.slice(scopeName.length + 2);
    const versions = this.data.get(typesDirectoryName);
    const depVersion = new semver.Range(dep.version === "*" ? "*" : `^${formatTypingVersion(dep.version)}`);
    return (versions && versions.tryGet(depVersion)?.id) || dep;
  }

  resolve(dep: PackageId): PackageIdWithDefiniteVersion {
    const typesDirectoryName = dep.typesDirectoryName ?? dep.name.slice(scopeName.length + 2);
    const versions = this.data.get(typesDirectoryName);
    if (!versions) {
      throw new Error(`No typings found with directory name '${dep.typesDirectoryName}'.`);
    }
    const depVersion = new semver.Range(dep.version === "*" ? "*" : `^${formatTypingVersion(dep.version)}`);
    return versions.get(depVersion).id;
  }

  /** Gets the latest version of a package. E.g. getLatest(node v6) was node v10 (before node v11 came out). */
  getLatest(pkg: TypingsData): TypingsData {
    return pkg.isLatest ? pkg : this.getLatestVersion(pkg.typesDirectoryName);
  }

  private getLatestVersion(typesDirectoryName: string): TypingsData {
    const latest = this.tryGetLatestVersion(typesDirectoryName);
    if (!latest) {
      throw new Error(`No such package ${typesDirectoryName}.`);
    }
    return latest;
  }

  tryGetLatestVersion(typesDirectoryName: string): TypingsData | undefined {
    const versions = this.data.get(typesDirectoryName);
    return versions && versions.getLatest();
  }

  getTypingsData(id: PackageId): TypingsData {
    const pkg = this.tryGetTypingsData(id);
    if (!pkg) {
      throw new Error(`No typings available for ${JSON.stringify(id)}`);
    }
    return pkg;
  }

  tryGetTypingsData(pkg: PackageId): TypingsData | undefined {
    const typesDirectoryName = pkg.typesDirectoryName ?? pkg.name.slice(scopeName.length + 2);
    const versions = this.data.get(typesDirectoryName);
    return (
      versions && versions.tryGet(new semver.Range(pkg.version === "*" ? "*" : `^${formatTypingVersion(pkg.version)}`))
    );
  }

  allPackages(): readonly AnyPackage[] {
    return [...this.allTypings(), ...this.allNotNeeded()];
  }

  /** Note: this includes older version directories (`foo/v0`) */
  allTypings(): readonly TypingsData[] {
    return assertSorted(Array.from(flattenData(this.data)), (t) => t.name);
  }

  allLatestTypings(): readonly TypingsData[] {
    return assertSorted(
      Array.from(this.data.values()).map((versions) => versions.getLatest()),
      (t) => t.name
    );
  }

  allNotNeeded(): readonly NotNeededPackage[] {
    return this.notNeeded;
  }

  /** Returns all of the dependencies *that are typed on DT*, ignoring others, and including test dependencies. */
  *allDependencyTypings(pkg: TypingsData): Iterable<TypingsData> {
    for (const [name, version] of pkg.allPackageJsonDependencies()) {
      if (!name.startsWith(`@${scopeName}/`)) continue;
      if (pkg.name === name) continue;
      const typesDirectoryName = removeTypesScope(name);
      const versions = this.data.get(typesDirectoryName);
      if (versions) {
        yield versions.get(new semver.Range(version), pkg.name + ":" + JSON.stringify((versions as any).versions));
      }
    }
  }
}

export function removeTypesScope(name: string) {
  return slicePrefixes(name, `@${scopeName}/`);
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

/** Prefer to use `AnyPackage` instead of this. */
export abstract class PackageBase {
  static compare(a: PackageBase, b: PackageBase): number {
    return a.name.localeCompare(b.name);
  }

  /** The package.json "name" field */
  abstract readonly name: string;
  /**
   * For non-npm packages, the human-readable library name recorded in
   * the package.json "nonNpmDescription" field. Otherwise, the name of
   * the implementation library, as computed from the package.json "name".
   */
  abstract readonly libraryName: string;
  abstract readonly major: number;
  abstract readonly minor: number;
  abstract readonly isLatest: boolean;

  /**
   * The immediate subdirectory name in DefinitelyTyped/types/.
   * Must be equal to the package.json "name" field without the "@types/" prefix.
   * Does not include the version directory.
   */
  get typesDirectoryName(): string {
    return this.name.slice(scopeName.length + 2);
  }

  /** Short description for debug output. */
  get desc(): string {
    return this.isLatest ? this.name : `${this.name} v${this.major}.${this.minor}`;
  }

  get id(): PackageIdWithDefiniteVersion {
    return { typesDirectoryName: this.typesDirectoryName, version: { major: this.major, minor: this.minor } };
  }

  isNotNeeded(): this is NotNeededPackage {
    return this instanceof NotNeededPackage;
  }
}

interface NotNeededPackageRaw {
  /**
   * The npm name of the implementation library that the types package was for.
   */
  readonly libraryName: string;
  /**
   * If this is available, @types typings are deprecated as of this version.
   * This is useful for packages that previously had DefinitelyTyped definitions but which now provide their own.
   */
  // This must be "major.minor.patch"
  readonly asOfVersion: string;
}

export class NotNeededPackage extends PackageBase {
  readonly version: semver.SemVer;

  get license(): License.MIT {
    return License.MIT;
  }

  static fromRaw(name: string, raw: NotNeededPackageRaw) {
    if (name !== name.toLowerCase()) {
      throw new Error(`not-needed package '${name}' must use all lower-case letters.`);
    }
    for (const key of Object.keys(raw)) {
      if (!["libraryName", "sourceRepoURL", "asOfVersion"].includes(key)) {
        throw new Error(`Unexpected key in not-needed package: ${key}`);
      }
    }
    if (raw.libraryName !== raw.libraryName.toLowerCase()) {
      throw new Error(`not-needed package '${name}' must use a libraryName that is all lower-case letters.`);
    }

    return new NotNeededPackage(name, raw.libraryName, raw.asOfVersion);
  }

  constructor(readonly name: string, readonly libraryName: string, asOfVersion: string) {
    super();
    assert(libraryName && name && asOfVersion);
    this.version = new semver.SemVer(asOfVersion);
    this.name = name.startsWith(`@${scopeName}/`) ? name : `@${scopeName}/${name}`;
  }

  get major(): number {
    return this.version.major;
  }
  get minor(): number {
    return this.version.minor;
  }

  // A not-needed package has no other versions. (that would be possible to allow but nobody has really needed it yet)
  get isLatest(): boolean {
    return true;
  }
  get minTypeScriptVersion(): TypeScriptVersion {
    return TypeScriptVersion.lowest;
  }

  deprecatedMessage(): string {
    return `This is a stub types definition. ${this.libraryName} provides its own type definitions, so you do not need this installed.`;
  }
}

export interface TypingsVersionsRaw {
  [version: `${number}.${number}`]: TypingsDataRaw;
}

/** Minor may be unknown if parsed from a major-only version directory, like 'types/v15' */
export interface DirectoryParsedTypingVersion {
  major: number;
  minor?: number;
}

/** Version parsed from DT header comment, so both major and minor are known */
export interface HeaderParsedTypingVersion {
  major: number;
  minor: number;
}

export function formatTypingVersion(version: DirectoryParsedTypingVersion) {
  return `${version.major}${version.minor === undefined ? "" : `.${version.minor}`}`;
}

/** Maps name to version */
export type PackageJsonDependencies = Record<string, string>;

export interface TypingsDataRaw {
  /**
   * Header info contained in package.json
   */
  readonly header: Header;

  /**
   * Package `imports`, as read in the `package.json` file
   */
  readonly imports?: object;

  /**
   * Package `exports`, as read in the `package.json` file
   */
  readonly exports?: object | string;

  /**
   * Package `type`, as read in the `package.json` file
   */
  readonly type?: string;

  /**
   * Packages that provide definitions that this package depends on.
   * NOTE: Includes `@types/` packages.
   */
  readonly dependencies: PackageJsonDependencies;

  /**
   * Packages that this package's tests or other development depends on.
   */
  readonly devDependencies: PackageJsonDependencies;

  /**
   * The [older] version of the library that this definition package refers to, as represented *on-disk*.
   *
   * @note The latest version always exists in the root of the package tree and thus does not have a value for this property.
   */
  readonly libraryVersionDirectoryName?: string;

  /**
   * List of TS versions that have their own directories, and corresponding "typesVersions" in package.json.
   * Usually empty.
   */
  readonly typesVersions: readonly TypeScriptVersion[];

  /**
   * Files that should be published with this definition, e.g. ["jquery.d.ts", "jquery-extras.d.ts"]
   *
   * Does *not* include `package.json` because that is not copied directly, but generated from TypingsData.
   */
  readonly files: readonly string[];

  /**
   * The license that this definition package is released under.
   *
   * Can be either MIT or Apache v2, defaults to MIT when not explicitly defined in this package’s "package.json".
   */
  readonly license: License;

  /**
   * A hash of the names and contents of the `files` list, used for versioning.
   */
  readonly contentHash: string;
}

export class TypingsVersions {
  private readonly map: ReadonlyMap<semver.SemVer, TypingsData>;

  /**
   * Sorted from latest to oldest.
   */
  private readonly versions: semver.SemVer[];

  constructor(data: TypingsVersionsRaw) {
    /**
     * Sorted from latest to oldest so that we publish the current version first.
     * This is important because older versions repeatedly reset the "latest" tag to the current version.
     */
    this.versions = Object.keys(data).map((key) => new semver.SemVer(`${key}.9999`));
    this.versions.sort(semver.rcompare);

    this.map = new Map(
      this.versions.map((version, i) => [version, new TypingsData(data[`${version.major}.${version.minor}`], !i)])
    );
  }

  getAll(): Iterable<TypingsData> {
    return this.map.values();
  }
  get(version: semver.Range, errorMessage?: string): TypingsData {
    const data = this.tryGet(version);
    if (!data) {
      throw new Error(`Could not match version ${version} in ${this.versions}. ${errorMessage || ""}`);
    }
    return data;
  }
  tryGet(version: semver.Range): TypingsData | undefined {
    try {
      const found = this.versions.find((v) => version.test(v));
      return found && this.map.get(found);
    } catch (e) {
      console.log(version);
      throw e;
    }
  }

  getLatest(): TypingsData {
    return this.map.get(this.versions[0])!;
  }
}

export class TypingsData extends PackageBase {
  constructor(private readonly data: TypingsDataRaw, readonly isLatest: boolean) {
    super();
  }

  get name(): string {
    return this.data.header.name;
  }
  get libraryName(): string {
    return (
      this.data.header.nonNpmDescription ?? unmangleScopedPackage(this.typesDirectoryName) ?? this.typesDirectoryName
    );
  }
  get contributors(): readonly Contributor[] {
    return this.data.header.owners.map((o) => ({
      ...o,
      url: "githubUsername" in o ? `https://github.com/${o.githubUsername}` : o.url,
    }));
  }
  get major(): number {
    return this.data.header.libraryMajorVersion;
  }
  get minor(): number {
    return this.data.header.libraryMinorVersion;
  }

  get minTypeScriptVersion(): TypeScriptVersion {
    return TypeScriptVersion.isSupported(this.data.header.minimumTypeScriptVersion)
      ? this.data.header.minimumTypeScriptVersion
      : TypeScriptVersion.lowest;
  }
  get typesVersions(): readonly TypeScriptVersion[] {
    return this.data.typesVersions;
  }

  get files(): readonly string[] {
    return this.data.files;
  }
  get dtsFiles(): readonly string[] {
    return this.data.files.filter((f) => f.endsWith(".d.ts") || f.endsWith(".d.mts") || f.endsWith(".d.cts"));
  }
  get license(): License {
    return this.data.license;
  }
  get dependencies(): PackageJsonDependencies {
    return this.data.dependencies ?? {};
  }
  get devDependencies(): PackageJsonDependencies {
    return this.data.devDependencies ?? {};
  }
  *allPackageJsonDependencies(): Iterable<[string, string]> {
    for (const [name, version] of Object.entries(this.dependencies)) {
      yield [name, version];
    }
    for (const [name, version] of Object.entries(this.devDependencies)) {
      yield [name, version];
    }
  }
  get contentHash(): string {
    return this.data.contentHash;
  }
  get projectName(): string | undefined {
    return this.data.header.projects[0];
  }
  get type() {
    return this.data.type;
  }

  get imports() {
    return this.data.imports;
  }

  get exports() {
    return this.data.exports;
  }

  get nonNpm() {
    return this.data.header.nonNpm;
  }

  get versionDirectoryName() {
    return this.data.libraryVersionDirectoryName && `v${this.data.libraryVersionDirectoryName}`;
  }

  /** Path to this package, *relative* to the DefinitelyTyped directory. */
  get subDirectoryPath(): string {
    return this.isLatest ? this.typesDirectoryName : `${this.typesDirectoryName}/${this.versionDirectoryName}`;
  }
}

/** Uniquely identifies a package. */
export type PackageId =
  | {
      readonly typesDirectoryName: string;
      readonly version: DirectoryParsedTypingVersion | "*";
    }
  | {
      readonly name: string;
      readonly typesDirectoryName?: undefined;
      readonly version: DirectoryParsedTypingVersion | "*";
    };

export interface PackageIdWithDefiniteVersion {
  readonly typesDirectoryName: string;
  readonly version: HeaderParsedTypingVersion;
}

export interface TypesDataFile {
  readonly [packageName: string]: TypingsVersionsRaw;
}
function readTypesDataFile(): Promise<TypesDataFile> {
  return readDataFile("parse-definitions", typesDataFilename) as Promise<TypesDataFile>;
}

export function readNotNeededPackages(dt: FS): readonly NotNeededPackage[] {
  const rawJson = dt.readJson("notNeededPackages.json"); // tslint:disable-line await-promise (tslint bug)
  return Object.entries((rawJson as { readonly packages: readonly NotNeededPackageRaw[] }).packages).map((entry) =>
    NotNeededPackage.fromRaw(...entry)
  );
}

/**
 * For "types/a/b/c", returns { name: "a", version: "*" }.
 * For "types/a/v3/c", returns { name: "a", version: 3 }.
 * For "x", returns undefined.
 */
export function getDependencyFromFile(
  file: string
): { typesDirectoryName: string; version: DirectoryParsedTypingVersion | "*" } | undefined {
  const parts = file.split("/");
  if (parts.length <= 2) {
    // It's not in a typings directory at all.
    return undefined;
  }

  const [typesDirName, name, subDirName] = parts; // Ignore any other parts

  if (typesDirName !== typesDirectoryName) {
    return undefined;
  }

  if (subDirName) {
    const version = parseVersionFromDirectoryName(subDirName);
    if (version !== undefined) {
      return { typesDirectoryName: name, version };
    }
  }

  return { typesDirectoryName: name, version: "*" };
}
