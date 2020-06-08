import { join as joinPaths } from "path";

const root = joinPaths(__dirname, "..", "..");
export const cacheDirPath = joinPaths(root, "cache");
export const outputDirPath = joinPaths(root, "output");
export const validateOutputPath = joinPaths(root, "validateOutput");
export const logDir = joinPaths(root, "logs");

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";
/** The branch that DefinitelyTyped is sourced from. */
export const sourceBranch = "master";
/** URL of azure keyvault. */
export const azureKeyvault = "https://types-publisher-keys.vault.azure.net";
