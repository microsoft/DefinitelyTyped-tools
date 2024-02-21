import { joinPaths, createGitHubStringSetGetter } from "@definitelytyped/utils";

const root = joinPaths(__dirname, "..", "..");
const storageDirPath = process.env.STORAGE_DIR || root;
export const dataDirPath = joinPaths(storageDirPath, "data");
export const sourceBranch = "master";
export const typesDirectoryName = "types";

/** URL to download the repository from. */
export const definitelyTypedZipUrl = `https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/${sourceBranch}`;

export const getAllowedPackageJsonDependencies = createGitHubStringSetGetter(
  "packages/definitions-parser/allowedPackageJsonDependencies.txt",
  joinPaths(root, "allowedPackageJsonDependencies.txt"),
);
