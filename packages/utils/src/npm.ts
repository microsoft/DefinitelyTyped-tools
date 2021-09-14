import assert = require("assert");
import { ensureFile, pathExists, readJson, writeJson, readFile } from "fs-extra";
import RegClient from "@qiwi/npm-registry-client";
import { resolve as resolveUrl } from "url";
import { joinPaths } from "./fs";
import { loggerWithErrors, Logger } from "./logging";
import { mapToRecord, recordToMap } from "./collections";
import { Fetcher, createTgz } from "./io";
import { sleep, identity } from "./miscellany";
import { assertNever } from "./assertions";

export const npmRegistryHostName = "registry.npmjs.org";
export const githubRegistryHostName = "npm.pkg.github.com";
export const npmRegistry = `https://${npmRegistryHostName}/`;
export const githubRegistry = `https://${githubRegistryHostName}/`;
export const npmApi = "api.npmjs.org";

const defaultCacheDir = joinPaths(__dirname, "..", "cache");
const cacheFileBasename = "npmInfo.json";

/** Which registry to publish to */
export enum Registry {
  /** types-registry and @types/* on NPM */
  NPM,
  /** @definitelytyped/types-registry and @types/* on Github */
  Github
}

export type NpmInfoCache = ReadonlyMap<string, NpmInfo>;

export interface NpmInfoRaw {
  readonly "dist-tags": {
    readonly [tag: string]: string;
  };
  readonly versions: NpmInfoRawVersions;
  readonly time: {
    readonly [s: string]: string;
  };
  readonly homepage: string;
}
export interface NpmInfoRawVersions {
  readonly [version: string]: NpmInfoVersion;
}

// Processed npm info. Intentially kept small so it can be cached.
export interface NpmInfo {
  readonly distTags: Map<string, string>;
  readonly versions: Map<string, NpmInfoVersion>;
  readonly time: Map<string, string>;
  readonly homepage: string;
}
export interface NpmInfoVersion {
  readonly typesPublisherContentHash?: string;
  readonly deprecated?: string;
}

export interface CachedNpmInfoClient {
  getNpmInfoFromCache(escapedPackageName: string): NpmInfo | undefined;
  fetchAndCacheNpmInfo(escapedPackageName: string): Promise<NpmInfo | undefined>;
}

export async function withNpmCache<T>(
  uncachedClient: UncachedNpmInfoClient,
  cb: (client: CachedNpmInfoClient) => Promise<T>,
  cacheDir = defaultCacheDir
): Promise<T> {
  const log = loggerWithErrors()[0];
  const cacheFile = joinPaths(cacheDir, cacheFileBasename);
  let unroll: Map<string, NpmInfo>;
  log.info(`Checking for cache file at ${cacheFile}...`);
  const cacheFileExists = await pathExists(cacheFile);
  if (cacheFileExists) {
    log.info("Reading cache file...");
    const cachedJson = (await readJson(cacheFile)) as Record<string, NpmInfoRaw>;
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
    if (info) {
      unroll.set(escapedPackageName, info);
    }
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
    const info = (await this.fetcher.fetchJson({
      hostname: npmRegistryHostName,
      path: escapedPackageName,
      retries: true
    })) as { readonly error: string } | NpmInfoRaw;
    if ("error" in info) {
      if (info.error === "Not found") {
        return undefined;
      }
      throw new Error(`Error getting version at ${escapedPackageName}: ${info.error}`);
    }
    if (!info["dist-tags"] && !info.versions) {
      // Unpublished
      return undefined;
    }
    return info;
  }

  // See https://github.com/npm/download-counts
  async getDownloads(packageNames: readonly string[]): Promise<readonly number[]> {
    // NPM uses a different API if there's only a single name, so ensure there's at least 2 for every batch of 128.
    const names = packageNames.length % 128 === 1 ? [...packageNames, "dummy"] : packageNames;
    const nameGroups = Array.from(splitToFixedSizeGroups(names, 128)); // NPM has a limit of 128 packages at a time.

    const out: number[] = [];
    for (const nameGroup of nameGroups) {
      const data = (await this.fetcher.fetchJson({
        hostname: npmApi,
        path: `/downloads/point/last-month/${nameGroup.join(",")}`,
        retries: true
      })) as { readonly error: string } | { readonly [key: string]: { readonly downloads: number } };
      if ("error" in data) {
        throw new Error(data.error as string);
      }
      for (const key of Object.keys(data)) {
        assert(
          key === names[out.length],
          `at index ${out.length} of ${Object.keys(data).toString()} : ${key} !== ${names[out.length]}`
        );
        out.push(data[key] ? data[key].downloads : 0);
      }
    }
    return out;
  }
}

function splitToFixedSizeGroups(names: readonly string[], chunkSize: number): readonly (readonly string[])[] {
  const out: string[][] = [];
  for (let i = 0; i < names.length; i += chunkSize) {
    out.push(names.slice(i, i + chunkSize));
  }
  return out;
}

type NeedToFixNpmRegistryClientTypings = any;

export class NpmPublishClient {
  static async create(
    token: string,
    config?: NeedToFixNpmRegistryClientTypings,
    registry: Registry = Registry.NPM
  ): Promise<NpmPublishClient> {
    switch (registry) {
      case Registry.NPM:
        return new NpmPublishClient(new RegClient(config), { token }, npmRegistry);
      case Registry.Github:
        return new NpmPublishClient(new RegClient(config), { token }, githubRegistry);
      default:
        assertNever(registry);
    }
  }

  private constructor(
    private readonly client: RegClient,
    private readonly auth: NeedToFixNpmRegistryClientTypings,
    private readonly registry: string
  ) {}

  async publish(publishedDirectory: string, packageJson: {}, dry: boolean, log: Logger): Promise<void> {
    const readme = await readFile(joinPaths(publishedDirectory, "README.md"));

    return new Promise<void>((resolve, reject) => {
      const body = createTgz(publishedDirectory, reject);
      const metadata = { readme, ...packageJson };
      if (dry) {
        log(`(dry) Skip publish of ${publishedDirectory} to ${this.registry}`);
      }
      resolve(
        dry
          ? undefined
          : promisifyVoid(cb => {
              this.client.publish(this.registry, { access: "public", auth: this.auth, metadata: metadata as NeedToFixNpmRegistryClientTypings, body: body as NeedToFixNpmRegistryClientTypings }, cb);
            })
      );
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
      auth: this.auth
    };
    return promisifyVoid(cb => {
      this.client.deprecate(url, params, cb);
    });
  }
}

function npmInfoFromJson(n: NpmInfoRaw): NpmInfo {
  return {
    ...n,
    distTags: recordToMap(n["dist-tags"], identity),
    // Callback ensures we remove any other properties
    versions: recordToMap(n.versions, ({ typesPublisherContentHash, deprecated }) => ({
      typesPublisherContentHash,
      deprecated
    })),
    time: recordToMap(n.time)
  };
}

function jsonFromNpmInfo(n: NpmInfo): NpmInfoRaw {
  return {
    ...n,
    "dist-tags": mapToRecord(n.distTags),
    versions: mapToRecord(n.versions),
    time: mapToRecord(n.time)
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
