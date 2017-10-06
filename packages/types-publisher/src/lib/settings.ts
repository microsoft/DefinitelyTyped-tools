import { join as joinPaths } from "path";

/** URL of the NPM registry to upload to. */
export const npmRegistry = "https://registry.npmjs.org/";
/** Note: this is 'types' and not '@types' */
export const scopeName = "types";
export const outputPath = "./output";
export const validateOutputPath = joinPaths(__dirname, "..", "..", "validateOutput");
/** Git location of the source repository. */
export const sourceRepository = "https://github.com/DefinitelyTyped/DefinitelyTyped.git";
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
