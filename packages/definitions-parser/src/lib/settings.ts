import { joinPaths, readFileSync } from "@definitelytyped/utils";
import { getUrlContentsAsString, withCache } from "./utils";

const root = joinPaths(__dirname, "..", "..");
export const storageDirPath = process.env.STORAGE_DIR || root;
export const dataDirPath = joinPaths(storageDirPath, "data");

export const sourceBranch = "master";
export const typesDirectoryName = "types";

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";

/** Note: this is 'types' and not '@types' */
export const scopeName = "types";

const allowedPackageJsonDependenciesUrl =
  "https://raw.githubusercontent.com/microsoft/DefinitelyTyped-tools/master/packages/definitions-parser/allowedPackageJsonDependencies.txt";

export const getAllowedPackageJsonDependencies = withCache(60 * 60 * 1000, () => {
  return new Promise<ReadonlySet<string>>(async resolve => {
    let raw = readFileSync(joinPaths(root, "allowedPackageJsonDependencies.txt"));
    if (process.env.NODE_ENV !== "test") {
      try {
        raw = await getUrlContentsAsString(allowedPackageJsonDependenciesUrl);
      } catch (err) {
        console.error(
          "Getting the latest allowedPackageJsonDependencies.txt from GitHub failed. Falling back to local copy.\n" +
            err.message
        );
      }
    }
    resolve(new Set(raw.split(/\r?\n/)));
  });
});
