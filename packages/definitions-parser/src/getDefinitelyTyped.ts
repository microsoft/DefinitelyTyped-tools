import { ensureDir } from "fs-extra";
import {
  DiskFS,
  downloadAndExtractFile,
  LoggerWithErrors,
  FS,
  exec
} from "@definitelytyped/utils";

import { dataDirPath, definitelyTypedZipUrl } from "./lib/settings";
import { ParseDefinitionsOptions } from "./lib/common";

export async function getDefinitelyTyped(options: ParseDefinitionsOptions, log: LoggerWithErrors): Promise<FS> {
    if (options.definitelyTypedPath === undefined) {
        log.info("Downloading Definitely Typed ...");
        await ensureDir(dataDirPath);
        return downloadAndExtractFile(definitelyTypedZipUrl);
    }
    const { error, stderr, stdout } = await exec("git diff --name-only", options.definitelyTypedPath);
    if (error) { throw error; }
    if (stderr) { throw new Error(stderr); }
    if (stdout) { throw new Error(`'git diff' should be empty. Following files changed:\n${stdout}`); }
    log.info(`Using local Definitely Typed at ${options.definitelyTypedPath}.`);
    return new DiskFS(`${options.definitelyTypedPath}/`);
}

export function getLocallyInstalledDefinitelyTyped(path: string): FS {
    return new DiskFS(`${path}/`);
}
