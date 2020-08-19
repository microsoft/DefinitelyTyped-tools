import { joinPaths, readFileSync } from "@definitelytyped/utils";
import { getUrlContentsAsString } from "./utils";

const root = joinPaths(__dirname, "..", "..");
export const dataDirPath = joinPaths(root, "data");

export const sourceBranch = "master";
export const typesDirectoryName = "types";

/** URL to download the repository from. */
export const definitelyTypedZipUrl = "https://codeload.github.com/DefinitelyTyped/DefinitelyTyped/tar.gz/master";

/** Note: this is 'types' and not '@types' */
export const scopeName = "types";

const allowedPackageJsonDependenciesUrl =
  "https://raw.githubusercontent.com/microsoft/DefinitelyTyped-tools/master/packages/definitions-parser/allowedPackageJsonDependencies.txt";
let allowedPackageJsonDependencies: Promise<ReadonlySet<string>>;
export async function getAllowedPackageJsonDependencies(): Promise<ReadonlySet<string>> {
  return (
    allowedPackageJsonDependencies ||
    (allowedPackageJsonDependencies = new Promise<ReadonlySet<string>>(async resolve => {
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
    }))
  );
}
