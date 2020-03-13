import { joinPaths, readFileSync } from "@definitelytyped/utils";

const root = joinPaths(__dirname, "..", "..");
export const dataDirPath = joinPaths(root, "data");

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";

export const dependenciesWhitelist: ReadonlySet<string> = new Set(
  readFileSync(joinPaths(root, "dependenciesWhitelist.txt")).split(/\r?\n/)
);

/** Note: this is 'types' and not '@types' */
export const scopeName = "types";
