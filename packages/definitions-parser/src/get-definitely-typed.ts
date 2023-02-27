import { ensureDir } from "fs-extra";
import { DiskFS, downloadAndExtractFile, LoggerWithErrors, FS, exec } from "@definitelytyped/utils";

import { dataDirPath, definitelyTypedZipUrl } from "./lib/settings";
import { ExecException } from "child_process";
import path from "path";

/** Settings that may be determined dynamically. */
export interface ParseDefinitionsOptions {
  /**
   * e.g. '../DefinitelyTyped'
   * This is overridden to `cwd` when running the tester, as that is run from within DefinitelyTyped.
   * If undefined, downloads instead.
   */
  readonly definitelyTypedPath: string | undefined;
  /** Whether to show progress bars. Good when running locally, bad when running in CI. */
  readonly progress: boolean;
  /** Disabled in CI since it has problems logging errors from other processes. */
  readonly parseInParallel: boolean;
}

export async function getDefinitelyTyped(options: ParseDefinitionsOptions, log: LoggerWithErrors): Promise<FS> {
  if (options.definitelyTypedPath === undefined) {
    log.info("Downloading Definitely Typed ...");
    await ensureDir(dataDirPath);
    log.info(dataDirPath + " exists.");
    return downloadAndExtractFile(definitelyTypedZipUrl, log);
  }
  const { error, stderr, stdout } = await exec("git diff --name-only", options.definitelyTypedPath);
  if (error) {
    throw new Error(error.message + ": " + (error as ExecException).cmd);
  }
  if (stderr) {
    throw new Error(stderr);
  }
  if (stdout) {
    throw new Error(`'git diff' should be empty. Following files changed:\n${stdout}`);
  }
  log.info(`Using local DefinitelyTyped at ${options.definitelyTypedPath}`);
  return new DiskFS(`${path.resolve(options.definitelyTypedPath)}/`);
}

export function getLocallyInstalledDefinitelyTyped(definitelyTypedPath: string): FS {
  return new DiskFS(`${path.resolve(definitelyTypedPath)}/`);
}
