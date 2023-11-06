import assert = require("assert");
import { Contributor, Header, License } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import {
  Dir,
  FS,
  InMemoryFS,
  assertDefined,
  atTypesSlash,
  computeHash,
  isDeclarationPath,
  isTypesPackageName,
  mustTrimAtTypesPrefix,
  trimAtTypesPrefixIfPresent,
  unique,
  unmangleScopedPackage,
} from "@definitelytyped/utils";
import * as semver from "semver";
import { getFiles, getTypingInfo, parseVersionFromDirectoryName } from "./lib/definition-parser";
import { getAllowedPackageJsonDependencies, typesDirectoryName } from "./lib/settings";

export class AllPackages {
  static fromFS(dt: FS) {
    return new AllPackages(dt, new Map(), readNotNeededPackages(dt));
  }

  static fromTestData(typingsVersionsRaw: Record<string, TypingsVersionsRaw>, notNeeded: readonly NotNeededPackage[]) {
    const rootDir = new Dir(/*parent*/ undefined);
    rootDir.set("types", new Dir(/*parent*/ rootDir));
    const fs = new InMemoryFS(rootDir, "/");
    return new AllPackages(
      fs,
      new Map(Object.entries(typingsVersionsRaw).map(([name, raw]) => [name, new TypingsVersions(fs, raw)])),
      notNeeded
    );
  }

  /** Use for `--single` tasks only. Do *not* call this in a loop! */
  static async readSingle(dt: FS, name: string): Promise<TypingsData> {
    const data = await getTypingInfo(name, dt);
    if (!data) {
      throw new Error(`Can't find package ${name}`);
    }
    if ("errors" in data) {
      throw new Error(`Errors while reading package ${name}: ${data.errors.join("\n")}`);
    }
    const versions = Object.values(data);
    if (versions.length > 1) {
      throw new Error(`Package ${name} has multiple versions.`);
    }
    return new TypingsData(dt, versions[0], /*isLatest*/ true);
  }

  /** Keys are `typesDirectoryName` strings */
  private readonly errors: Map<string, string[]> = new Map();
  private isComplete = false;

  private constructor(
    private dt: FS,
    /** Keys are `typesDirectoryName` strings */
    private readonly types: Map<string, TypingsVersions>,
    private readonly notNeeded: readonly NotNeededPackage[]
  ) {}

  getNotNeededPackage(typesDirectoryName: string): NotNeededPackage | undefined {
    return this.notNeeded.find((p) => p.typesDirectoryName === typesDirectoryName);
  }

  async hasTypingFor(dep: PackageId): Promise<boolean> {
    return (await this.tryGetTypingsData(dep)) !== undefined;
  }

  getErrorsAsArray() {
    return Array.from(this.errors.entries()).map(([name, errors]) => `${name}: ${errors.join("\n")}`);
  }

  /**
   * Whether a package maintains multiple minor versions of typings simultaneously by
   * using minor-versioned directories like 'react-native/v14.1'
   */
  async hasSeparateMinorVersions(typesDirectoryName: string) {
    const versions = Array.from(assertDefined(await this.tryGetTypingsVersions(typesDirectoryName)).getAll());
    const minors = versions.map((v) => v.minor);
    return minors.length !== unique(minors).length;
  }

  async tryResolve(dep: PackageId): Promise<PackageId> {
    const typesDirectoryName = dep.typesDirectoryName ?? trimAtTypesPrefixIfPresent(dep.name);
    const versions = await this.tryGetTypingsVersions(typesDirectoryName);
    const depVersion = new semver.Range(dep.version === "*" ? "*" : `^${formatTypingVersion(dep.version)}`);
    return (versions && versions.tryGet(depVersion)?.id) || dep;
  }

  async resolve(dep: PackageId): Promise<PackageIdWithDefiniteVersion> {
    const typesDirectoryName = dep.typesDirectoryName ?? trimAtTypesPrefixIfPresent(dep.name);
    const versions = await this.tryGetTypingsVersions(typesDirectoryName);
    if (!versions) {
      throw new Error(`No typings found with directory name '${dep.typesDirectoryName}'.`);
    }
    const depVersion = new semver.Range(dep.version === "*" ? "*" : `^${formatTypingVersion(dep.version)}`);
    return versions.get(depVersion).id;
  }

  /** Gets the latest version of a package. E.g. getLatest(node v6) was node v10 (before node v11 came out). */
  async getLatest(pkg: TypingsData): Promise<TypingsData> {
    return pkg.isLatest ? pkg : this.getLatestVersion(pkg.typesDirectoryName);
  }

  private async getLatestVersion(typesDirectoryName: string): Promise<TypingsData> {
    const latest = await this.tryGetLatestVersion(typesDirectoryName);
    if (!latest) {
      throw new Error(`No such package ${typesDirectoryName}.`);
    }
    return latest;
  }

  async tryGetLatestVersion(typesDirectoryName: string): Promise<TypingsData | undefined> {
    const versions = await this.tryGetTypingsVersions(typesDirectoryName);
    return versions && versions.getLatest();
  }

  async getTypingsData(id: PackageId): Promise<TypingsData> {
    const pkg = await this.tryGetTypingsData(id);
    if (!pkg) {
      throw new Error(`No typings available for ${JSON.stringify(id)}`);
    }
    return pkg;
  }

  async tryGetTypingsData(pkg: PackageId): Promise<TypingsData | undefined> {
    const typesDirectoryName = pkg.typesDirectoryName ?? trimAtTypesPrefixIfPresent(pkg.name);
    const versions = await this.tryGetTypingsVersions(typesDirectoryName);
    return (
      versions && versions.tryGet(new semver.Range(pkg.version === "*" ? "*" : `^${formatTypingVersion(pkg.version)}`))
    );
  }

  private async tryGetTypingsVersions(typesDirectoryName: string): Promise<TypingsVersions | undefined> {
    let versions = this.types.get(typesDirectoryName);
    if (versions) {
      return versions;
    }
    if (this.errors.has(typesDirectoryName)) {
      return undefined;
    }
    const raw = await getTypingInfo(typesDirectoryName, this.dt);
    if (!raw) {
      return undefined;
    }
    if ("errors" in raw) {
      this.errors.set(typesDirectoryName, raw.errors);
      return undefined;
    }
    versions = new TypingsVersions(this.dt, raw);
    this.types.set(typesDirectoryName, versions);
    return versions;
  }

  async allPackages(): Promise<readonly AnyPackage[]> {
    return [...(await this.allTypings()), ...this.allNotNeeded()];
  }

  /** Note: this includes older version directories (`foo/v0`) */
  async allTypings(): Promise<readonly TypingsData[]> {
    await this.readAllTypings();
    return Array.from(flattenData(this.types));
  }

  async allLatestTypings(): Promise<readonly TypingsData[]> {
    await this.readAllTypings();
    return Array.from(this.types.values()).map((versions) => versions.getLatest());
  }

  allNotNeeded(): readonly NotNeededPackage[] {
    return this.notNeeded;
  }

  /** Returns all of the dependencies *that are typed on DT*, ignoring others, and including test dependencies. */
  async *allDependencyTypings(pkg: TypingsData): AsyncIterable<TypingsData> {
    for (const [name, version] of pkg.allPackageJsonDependencies()) {
      if (!isTypesPackageName(name)) continue;
      if (pkg.name === name) continue;
      const typesDirectoryName = mustTrimAtTypesPrefix(name);
      const versions = await this.tryGetTypingsVersions(typesDirectoryName);
      if (versions) {
        yield versions.get(new semver.Range(version), pkg.name + ":" + JSON.stringify((versions as any).versions));
      }
    }
  }

  private async readAllTypings() {
    if (this.isComplete) {
      return;
    }
    // populate cache so every directory doesn't try to request this from GH
    await getAllowedPackageJsonDependencies();
    const types = this.dt.subDir("types");
    await Promise.all(
      types.readdir().map(async (typesDirectoryName) => {
        if (!types.isDirectory(typesDirectoryName) || !types.subDir(typesDirectoryName).exists("package.json")) {
          return;
        }
        await this.tryGetTypingsVersions(typesDirectoryName);
      })
    );
    this.isComplete = true;
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
    return mustTrimAtTypesPrefix(this.name);
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
    this.name = isTypesPackageName(name) ? name : `${atTypesSlash}${name}`;
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
   * The license that this definition package is released under.
   *
   * Can be either MIT or Apache v2, defaults to MIT when not explicitly defined in this package’s "package.json".
   */
  readonly license: License;

  /**
   * Which subdirectories of this package are older versions, e.g. `v1`, `v0.1`, `v15`.
   */
  readonly olderVersionDirectories: readonly string[];
}

export class TypingsVersions {
  private readonly map: ReadonlyMap<semver.SemVer, TypingsData>;

  /**
   * Sorted from latest to oldest.
   */
  private readonly versions: semver.SemVer[];

  constructor(dt: FS, data: TypingsVersionsRaw) {
    /**
     * Sorted from latest to oldest so that we publish the current version first.
     * This is important because older versions repeatedly reset the "latest" tag to the current version.
     */
    this.versions = Object.keys(data).map((key) => new semver.SemVer(`${key}.9999`));
    this.versions.sort(semver.rcompare);

    this.map = new Map(
      this.versions.map((version, i) => [version, new TypingsData(dt, data[`${version.major}.${version.minor}`], !i)])
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
  constructor(private dt: FS, private readonly data: TypingsDataRaw, readonly isLatest: boolean) {
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

  private _files: readonly string[] | undefined;
  getFiles(): readonly string[] {
    if (!this._files) {
      const files = getFiles(this.dt, this, this.data.olderVersionDirectories);
      this._files = files;
    }
    return this._files;
  }

  getDtsFiles(): readonly string[] {
    return this.getFiles().filter(isDeclarationPath);
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

  private _contentHash: string | undefined;
  getContentHash(): string {
    return (this._contentHash ??= hash(
      [...this.getFiles(), "package.json"],
      this.dt.subDir("types").subDir(this.subDirectoryPath)
    ));
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

function hash(files: readonly string[], fs: FS): string {
  const fileContents = files.map((f) => {
    let contents = fs.readFile(f);
    if (f === "package.json") {
      const parsed = JSON.parse(contents);
      contents = JSON.stringify(sortedObject(parsed));
    }
    return `${f}**${contents}`;
  });
  const allContent = fileContents.join("||");
  return computeHash(allContent);
}

function sortedObject(o: any): object {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(o).sort()) {
    out[key] = o[key];
  }
  return out;
}
