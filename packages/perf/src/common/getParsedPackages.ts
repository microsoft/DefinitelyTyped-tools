import * as os from "os";
import {
  AllPackages,
  typesDataFilename,
  getLocallyInstalledDefinitelyTyped,
  dataFilePath,
  parseDefinitions
} from "@definitelytyped/definitions-parser";
import { FS, consoleLogger } from "@definitelytyped/utils";
import { getSourceVersion, pathExists } from "./utils";

let parsedSourceVersion: string | undefined;
export async function getParsedPackages(
  definitelyTypedPath: string
): Promise<{
  definitelyTypedFS: FS;
  allPackages: AllPackages;
}> {
  const currentSourceVersion = await getSourceVersion(definitelyTypedPath);
  const definitelyTypedFS = getLocallyInstalledDefinitelyTyped(definitelyTypedPath);
  const isDebugging = process.execArgv.some(arg => arg.startsWith("--inspect"));
  const needsReparse = !parsedSourceVersion || parsedSourceVersion !== currentSourceVersion;
  if (process.env.NODE_ENV === "production" || needsReparse || !(await pathExists(dataFilePath(typesDataFilename)))) {
    await parseDefinitions(
      definitelyTypedFS,
      isDebugging
        ? undefined
        : {
            definitelyTypedPath,
            nProcesses: os.cpus().length
          },
      consoleLogger
    );
    parsedSourceVersion = currentSourceVersion;
  }
  const allPackages = await AllPackages.read(definitelyTypedFS);
  return { definitelyTypedFS, allPackages };
}
