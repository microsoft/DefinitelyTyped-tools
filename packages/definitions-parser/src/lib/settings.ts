import { joinPaths } from "@definitelytyped/utils";

const root = joinPaths(__dirname, "..", "..");
export const storageDirPath = process.env.STORAGE_DIR || root;
export const dataDirPath = joinPaths(storageDirPath, "data");

export const sourceBranch = "master";
export const typesDirectoryName = "types";

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";

/** Note: this is 'types' and not '@types' */
export const scopeName = "types";
