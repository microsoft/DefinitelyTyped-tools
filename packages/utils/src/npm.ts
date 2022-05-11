import * as os from "os";
import process from "process";
import { readFile } from "fs-extra";
import RegClient from "@qiwi/npm-registry-client";
import { resolve as resolveUrl } from "url";
import { joinPaths } from "./fs";
import { Logger } from "./logging";
import { createTgz } from "./io";

export const npmRegistryHostName = "registry.npmjs.org";
export const npmRegistry = `https://${npmRegistryHostName}/`;

export const cacheDir = joinPaths(process.env.GITHUB_ACTIONS ? joinPaths(__dirname, "..") : os.tmpdir(), "cache");

type NeedToFixNpmRegistryClientTypings = any;

export class NpmPublishClient {
  static async create(token: string, config?: NeedToFixNpmRegistryClientTypings): Promise<NpmPublishClient> {
    return new NpmPublishClient(new RegClient(config), { token }, npmRegistry);
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
          : promisifyVoid((cb) => {
              this.client.publish(
                this.registry,
                {
                  access: "public",
                  auth: this.auth,
                  metadata: metadata as NeedToFixNpmRegistryClientTypings,
                  body: body as NeedToFixNpmRegistryClientTypings,
                },
                cb
              );
            })
      );
    });
  }

  tag(packageName: string, version: string, distTag: string, dry: boolean, log: Logger): Promise<void> {
    if (dry) {
      log(`(dry) Skip tag of ${packageName}@${distTag} as ${version}`);
      return Promise.resolve();
    }
    return promisifyVoid((cb) => {
      this.client.distTags.add(this.registry, { package: packageName, version, distTag, auth: this.auth }, cb);
    });
  }

  deprecate(packageName: string, version: string, message: string): Promise<void> {
    const url = resolveUrl(npmRegistry, packageName);
    const params = {
      message,
      version,
      auth: this.auth,
    };
    return promisifyVoid((cb) => {
      this.client.deprecate(url, params, cb);
    });
  }
}

function promisifyVoid(callsBack: (cb: (error: Error | undefined) => void) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    callsBack((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
