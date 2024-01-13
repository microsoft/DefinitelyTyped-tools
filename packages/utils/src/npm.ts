import * as os from "os";
import process from "process";
import RegClient from "@qiwi/npm-registry-client";
import { joinPaths } from "./fs";
import { Logger } from "./logging";

export const cacheDir = joinPaths(process.env.GITHUB_ACTIONS ? joinPaths(__dirname, "../../..") : os.tmpdir(), "cache");

export class NpmPublishClient {
  private readonly client = new RegClient();

  constructor(private readonly token: string) {}

  tag(packageName: string, version: string, distTag: string, dry: boolean, log: Logger): Promise<void> {
    if (dry) {
      log(`(dry) Skip tag of ${packageName}@${distTag} as ${version}`);
      return Promise.resolve();
    }
    return promisifyVoid((cb) => {
      this.client.distTags.add(
        "https://registry.npmjs.org",
        { package: packageName, version, distTag, auth: { token: this.token } },
        cb,
      );
    });
  }

  deprecate(packageName: string, version: string, message: string): Promise<void> {
    const params = {
      message,
      version,
      auth: { token: this.token },
    };
    return promisifyVoid((cb) => {
      this.client.deprecate(`https://registry.npmjs.org/${packageName}`, params, cb);
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
