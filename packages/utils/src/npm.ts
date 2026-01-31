import * as os from "os";
import process from "process";
import { publish } from "libnpmpublish";
import npmFetch from "npm-registry-fetch";
import { joinPaths } from "./fs";
import { Logger } from "./logging";
import { createTgz, streamToBuffer } from "./io";

export const npmRegistryHostName = "registry.npmjs.org";
export const npmRegistry = `https://${npmRegistryHostName}/`;

export const cacheDir = joinPaths(process.env.GITHUB_ACTIONS ? joinPaths(__dirname, "../../..") : os.tmpdir(), "cache");

export interface NpmPublishClientConfig {
  defaultTag?: string;
}

export class NpmPublishClient {
  static async create(token: string, config: NpmPublishClientConfig = {}): Promise<NpmPublishClient> {
    return new NpmPublishClient(token, npmRegistry, config.defaultTag);
  }

  private constructor(
    private readonly token: string,
    private readonly registry: string,
    private readonly defaultTag: string | undefined,
  ) {}

  async publish(
    publishedDirectory: string,
    packageJson: Record<string, unknown>,
    dry: boolean,
    log: Logger,
  ): Promise<void> {
    if (dry) {
      log(`(dry) Skip publish of ${publishedDirectory} to ${this.registry}`);
      return;
    }

    const tarballBuffer = await streamToBuffer(
      createTgz(publishedDirectory, (err) => {
        throw err;
      }),
    );

    await publish(packageJson as { name: string; version: string }, tarballBuffer, {
      registry: this.registry,
      token: this.token,
      access: "public",
      tag: this.defaultTag,
    });
  }

  async tag(packageName: string, version: string, distTag: string, dry: boolean, log: Logger): Promise<void> {
    if (dry) {
      log(`(dry) Skip tag of ${packageName}@${distTag} as ${version}`);
      return;
    }

    await npmFetch(`/-/package/${encodeURIComponent(packageName)}/dist-tags/${encodeURIComponent(distTag)}`, {
      method: "PUT",
      registry: this.registry,
      token: this.token,
      body: JSON.stringify(version),
      headers: {
        "content-type": "application/json",
      },
    });
  }

  async deprecate(packageName: string, version: string, message: string): Promise<void> {
    // Fetch the current package metadata
    const packument = (await npmFetch.json(`/${encodeURIComponent(packageName)}`, {
      registry: this.registry,
      token: this.token,
    })) as { versions: Record<string, { deprecated?: string }> };

    // Update the deprecated field for the specified version
    if (!packument.versions[version]) {
      throw new Error(`Version ${version} not found in ${packageName}`);
    }
    packument.versions[version].deprecated = message;

    // PUT the updated packument back
    await npmFetch(`/${encodeURIComponent(packageName)}`, {
      method: "PUT",
      registry: this.registry,
      token: this.token,
      body: packument,
    });
  }
}
