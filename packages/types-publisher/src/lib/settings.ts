import { readFileSync } from "fs";
import { join as joinPaths } from "path";

/** URL of the NPM registry to upload to. */
export const npmRegistryHostName = "registry.npmjs.org";
export const githubRegistryHostName = "npm.pkg.github.com";
export const npmRegistry = `https://${npmRegistryHostName}/`;
export const githubRegistry = `https://${githubRegistryHostName}/`;
export const npmApi = "api.npmjs.org";
/** Note: this is 'types' and not '@types' */
export const scopeName = "types";
/** TODO: Change this to definitelytyped when it's ready */
export const orgName = "testtypepublishing";
const root = joinPaths(__dirname, "..", "..");
export const dataDirPath = joinPaths(root, "data");
export const outputDirPath = joinPaths(root, "output");
export const validateOutputPath = joinPaths(root, "validateOutput");
export const logDir = joinPaths(root, "logs");

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";
/** The branch that DefinitelyTyped is sourced from. */
export const sourceBranch = "master";

/** Name of the azure storage account. Used for uploading data and logs. */
export const azureStorageAccount = "typespublisher";
/** Name of the azure container. */
export const azureContainer = "typespublisher";
/** URL of azure keyvault. */
export const azureKeyvault = "https://types-publisher-keys.vault.azure.net";
/** Issue in types-publisher that we will use to report webhook errors. */
export const errorsIssue = "Microsoft/types-publisher/issues/40";

export const typesDirectoryName = "types";

export const dependenciesWhitelist: ReadonlySet<string> =
    new Set(readFileSync(joinPaths(root, "dependenciesWhitelist.txt"), "utf-8").split(/\r?\n/));
