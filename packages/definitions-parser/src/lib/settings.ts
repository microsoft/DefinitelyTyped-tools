import { joinPaths } from "@definitelytyped/utils";

const root = joinPaths(__dirname, "..", "..");
export const dataDirPath = joinPaths(root, "data");
export const outputDirPath = joinPaths(root, "output");
export const validateOutputPath = joinPaths(root, "validateOutput");
export const logDir = joinPaths(root, "logs");

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";
