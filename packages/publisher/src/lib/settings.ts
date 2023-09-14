import { join as joinPaths } from "path";

const root = joinPaths(__dirname, "..", "..");
const storageDirPath = process.env.STORAGE_DIR || root;
export const outputDirPath = joinPaths(storageDirPath, "output");
export const validateOutputPath = joinPaths(storageDirPath, "validateOutput");
export const logDir = joinPaths(storageDirPath, "logs");
export const lockFilePath = joinPaths(storageDirPath, "lock.json");

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";
/** The branch that DefinitelyTyped is sourced from. */
export const sourceBranch = "master";
