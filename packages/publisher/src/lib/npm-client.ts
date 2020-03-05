import assert = require("assert");
import { ensureFile, pathExists } from "fs-extra";
import RegClient = require("npm-registry-client");
import { resolve as resolveUrl } from "url";
import { createTgz } from "../util/tgz";

import { Registry } from "./common";
import { getSecret, Secret } from "./secrets";
import { githubRegistry, npmApi, npmRegistry, npmRegistryHostName } from "./settings";
import { joinPaths, loggerWithErrors, readJson, recordToMap, writeJson, mapToRecord, Fetcher, sleep, assertNever, Logger, readFile, identity, best, assertDefined, Semver } from "@definitelytyped/utils";
import { NotNeededPackage } from "@definitelytyped/definitions-parser";

const cacheFile = joinPaths(__dirname, "..", "..", "cache", "npmInfo.json");

export type NpmInfoCache = ReadonlyMap<string, NpmInfo>;

export interface NpmInfoRaw {
    readonly "dist-tags": {
        readonly [tag: string]: string;
    };
    readonly versions: NpmInfoRawVersions;
    readonly time: {
        readonly [s: string]: string;
    };
}
export interface NpmInfoRawVersions {
    readonly [version: string]: NpmInfoVersion;
}

// Processed npm info. Intentially kept small so it can be cached.
export interface NpmInfo {
    readonly distTags: Map<string, string>;
    readonly versions: Map<string, NpmInfoVersion>;
    readonly time: Map<string, string>;
}
export interface NpmInfoVersion {
    readonly typesPublisherContentHash?: string;
    readonly deprecated?: string;
}

export interface CachedNpmInfoClient {
    getNpmInfoFromCache(escapedPackageName: string): NpmInfo | undefined;
    fetchAndCacheNpmInfo(escapedPackageName: string): Promise<NpmInfo | undefined>;
}

export async function withNpmCache<T>(uncachedClient: UncachedNpmInfoClient, cb: (client: CachedNpmInfoClient) => Promise<T>): Promise<T> {
    const log = loggerWithErrors()[0];
    let unroll: Map<string, NpmInfo>;
    log.info(`Checking for cache file at ${cacheFile}...`);
    const cacheFileExists = await pathExists(cacheFile);
    if (cacheFileExists) {
        log.info("Reading cache file...");
        const cachedJson = await readJson(cacheFile) as Record<string, NpmInfoRaw>;
        log.info(`Cache file ${cacheFile} exists, copying to map...`);
        unroll = recordToMap(cachedJson, npmInfoFromJson);
    } else {
        log.info("Cache file doesn't exist, using empty map.");
        unroll = new Map();
    }

    const res = await cb({ getNpmInfoFromCache, fetchAndCacheNpmInfo });
    log.info("Writing npm cache.");
    await ensureFile(cacheFile);
    await writeJson(cacheFile, mapToRecord(unroll, jsonFromNpmInfo));
    return res;

    /** May return old info -- caller should check that this looks up-to-date. */
    function getNpmInfoFromCache(escapedPackageName: string): NpmInfo | undefined {
        return unroll.get(escapedPackageName);
    }

    /** Call this when the result of getNpmInfoFromCache looks potentially out-of-date. */
    async function fetchAndCacheNpmInfo(escapedPackageName: string): Promise<NpmInfo | undefined> {
        const info = await uncachedClient.fetchNpmInfo(escapedPackageName);
        if (info) { unroll.set(escapedPackageName, info); }
        return info;
    }

}

export class UncachedNpmInfoClient {
    private readonly fetcher = new Fetcher();

    async fetchNpmInfo(escapedPackageName: string): Promise<NpmInfo | undefined> {
        const raw = await this.fetchRawNpmInfo(escapedPackageName);
        await sleep(0.01); // If we don't do this, npm resets the connection?
        return raw === undefined ? undefined : npmInfoFromJson(raw);
    }

    async fetchRawNpmInfo(escapedPackageName: string): Promise<NpmInfoRaw | undefined> {
        const info = await this.fetcher.fetchJson({
            hostname: npmRegistryHostName,
            path: escapedPackageName,
            retries: true,
        }) as { readonly error: string } | NpmInfoRaw;
        if ("error" in info) {
            if (info.error === "Not found") { return undefined; }
            throw new Error(`Error getting version at ${escapedPackageName}: ${info.error}`);
        }
        if (!info["dist-tags"] && !info.versions) {
            // Unpublished
            return undefined;
        }
        return info;
    }

    // See https://github.com/npm/download-counts
    async getDownloads(packageNames: ReadonlyArray<string>): Promise<ReadonlyArray<number>> {
        // NPM uses a different API if there's only a single name, so ensure there's at least 2 for every batch of 128.
        const names = (packageNames.length % 128) === 1 ? [...packageNames, "dummy"] : packageNames;
        const nameGroups = Array.from(splitToFixedSizeGroups(names, 128)); // NPM has a limit of 128 packages at a time.

        const out: number[] = [];
        for (const nameGroup of nameGroups) {
            const data = await this.fetcher.fetchJson({
                hostname: npmApi,
                path: `/downloads/point/last-month/${nameGroup.join(",")}`,
                retries: true,
            }) as { readonly error: string } | { readonly [key: string]: { readonly downloads: number } };
            if ("error" in data) { throw new Error(data.error as string); }
            for (const key of Object.keys(data)) {
                assert(key === names[out.length], `at index ${out.length} of ${Object.keys(data).toString()} : ${key} !== ${names[out.length]}`);
                out.push(data[key] ? data[key].downloads : 0);
            }
        }
        return out;
    }
}

function splitToFixedSizeGroups(names: ReadonlyArray<string>, chunkSize: number): ReadonlyArray<ReadonlyArray<string>> {
    const out: string[][] = [];
    for (let i = 0; i < names.length; i += chunkSize) {
        out.push(names.slice(i, i + chunkSize));
    }
    return out;
}

export class NpmPublishClient {
    static async create(config?: RegClient.Config, registry: Registry = Registry.NPM): Promise<NpmPublishClient> {
        switch (registry) {
            case Registry.NPM:
                return new NpmPublishClient(new RegClient(config), { token: await getSecret(Secret.NPM_TOKEN) }, npmRegistry);
            case Registry.Github:
                return new NpmPublishClient(new RegClient(config), { token: await getSecret(Secret.GITHUB_PUBLISH_ACCESS_TOKEN) }, githubRegistry);
            default:
                assertNever(registry);
        }
    }

    private constructor(private readonly client: RegClient, private readonly auth: RegClient.Credentials, private readonly registry: string) {}

    async publish(publishedDirectory: string, packageJson: {}, dry: boolean, log: Logger): Promise<void> {
        const readme = await readFile(joinPaths(publishedDirectory, "README.md"));

        return new Promise<void>((resolve, reject) => {
            const body = createTgz(publishedDirectory, reject);
            const metadata = { readme, ...packageJson };
            if (dry) {
                log(`(dry) Skip publish of ${publishedDirectory} to ${this.registry}`);
            }
            resolve(dry ? undefined : promisifyVoid(cb => {
                this.client.publish(this.registry, { access: "public", auth: this.auth, metadata, body }, cb);
            }));
        });
    }

    tag(packageName: string, version: string, distTag: string, dry: boolean, log: Logger): Promise<void> {
        if (dry) {
            log(`(dry) Skip tag of ${packageName}@${distTag} as ${version}`);
            return Promise.resolve();
        }
        return promisifyVoid(cb => {
            this.client.distTags.add(this.registry, { package: packageName, version, distTag, auth: this.auth }, cb);
        });
    }

    deprecate(packageName: string, version: string, message: string): Promise<void> {
        const url = resolveUrl(npmRegistry, packageName.replace("/", "%2f"));
        const params = {
            message,
            version,
            auth: this.auth,
        };
        return promisifyVoid(cb => { this.client.deprecate(url, params, cb); });
    }
}

function npmInfoFromJson(n: NpmInfoRaw): NpmInfo {
    return {
        distTags: recordToMap(n["dist-tags"], identity),
        // Callback ensures we remove any other properties
        versions: recordToMap(n.versions, ({ typesPublisherContentHash, deprecated }) => ({ typesPublisherContentHash, deprecated })),
        time: recordToMap(n.time),
    };
}

function jsonFromNpmInfo(n: NpmInfo): NpmInfoRaw {
    return {
        "dist-tags": mapToRecord(n.distTags),
        versions: mapToRecord(n.versions),
        time: mapToRecord(n.time),
    };
}

function promisifyVoid(callsBack: (cb: (error: Error | undefined) => void) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        callsBack(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

/**
 * When we fail to publish a deprecated package, it leaves behind an entry in the time property.
 * So the keys of 'time' give the actual 'latest'.
 * If that's not equal to the expected latest, try again by bumping the patch version of the last attempt by 1.
 */
export function skipBadPublishes(pkg: NotNeededPackage, client: CachedNpmInfoClient, log: Logger) {
    // because this is called right after isAlreadyDeprecated, we can rely on the cache being up-to-date
    const info = assertDefined(client.getNpmInfoFromCache(pkg.fullEscapedNpmName));
    const notNeeded = pkg.version;
    const latest = Semver.parse(findActualLatest(info.time));
    if (latest.equals(notNeeded) || latest.greaterThan(notNeeded) ||
        info.versions.has(notNeeded.versionString) && !assertDefined(info.versions.get(notNeeded.versionString)).deprecated) {
        const plusOne = new Semver(latest.major, latest.minor, latest.patch + 1);
        log(`Deprecation of ${notNeeded.versionString} failed, instead using ${plusOne.versionString}.`);
        return new NotNeededPackage({
            asOfVersion: plusOne.versionString,
            libraryName: pkg.libraryName,
            sourceRepoURL: pkg.sourceRepoURL,
            typingsPackageName: pkg.name,
        });
    }
    return pkg;
}

function findActualLatest(times: Map<string, string>) {
    const actual = best(
        times, ([k, v], [bestK, bestV]) =>
            (bestK === "modified" || bestK === "created") ? true :
            (k === "modified" || k === "created") ? false :
            new Date(v).getTime() > new Date(bestV).getTime());
    if (!actual) {
        throw new Error("failed to find actual latest");
    }
    return actual[0];
}
