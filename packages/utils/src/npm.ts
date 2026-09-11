import * as os from "os";
import process from "process";
import fs from "fs";
import { publish } from "libnpmpublish";
import npmFetch from "npm-registry-fetch";
import { joinPaths } from "./fs";
import { Logger } from "./logging";
import { createTgz, streamToBuffer } from "./io";

export const cacheDir = joinPaths(process.env.GITHUB_ACTIONS ? joinPaths(__dirname, "../../..") : os.tmpdir(), "cache");

export class NpmPublishClient {
  static async create(token: string): Promise<NpmPublishClient> {
    return new NpmPublishClient(token);
  }

  private constructor(private readonly token: string) {}

  async publish(
    publishedDirectory: string,
    packageJson: Record<string, unknown>,
    tag: string,
    dry: boolean,
    log: Logger,
  ): Promise<void> {
    if (dry) {
      log(`(dry) Skip publish of ${publishedDirectory}`);
      return;
    }

    const readme = await fs.promises.readFile(joinPaths(publishedDirectory, "README.md"), "utf-8");
    const tarballBuffer = await streamToBuffer(
      createTgz(publishedDirectory, (err) => {
        throw err;
      }),
    );

    const manifest = { ...packageJson, readme } as unknown as { name: string; version: string };
    await publish(manifest, tarballBuffer, {
      forceAuth: { token: this.token },
      access: "public",
      defaultTag: tag,
    });
  }

  async tag(packageName: string, version: string, distTag: string, dry: boolean, log: Logger): Promise<void> {
    if (dry) {
      log(`(dry) Skip tag of ${packageName}@${distTag} as ${version}`);
      return;
    }

    await npmFetch(`/-/package/${encodeURIComponent(packageName)}/dist-tags/${encodeURIComponent(distTag)}`, {
      method: "PUT",
      forceAuth: { token: this.token },
      body: JSON.stringify(version),
      headers: {
        "content-type": "application/json",
      },
    });
  }

  async untag(packageName: string, distTag: string, dry: boolean, log: Logger): Promise<void> {
    if (dry) {
      log(`(dry) Skip removing tag ${packageName}@${distTag}`);
      return;
    }

    await npmFetch(`/-/package/${encodeURIComponent(packageName)}/dist-tags/${encodeURIComponent(distTag)}`, {
      method: "DELETE",
      forceAuth: { token: this.token },
    });
  }
}
