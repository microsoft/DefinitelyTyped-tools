import { join as joinPaths } from "path";

const root = joinPaths(__dirname, "..", "..");
const storageDirPath = process.env.STORAGE_DIR || root;
export const outputDirPath = joinPaths(storageDirPath, "output");
export const validateOutputPath = joinPaths(storageDirPath, "validateOutput");

/** The branch that DefinitelyTyped is sourced from. */
export const sourceBranch = "master";
