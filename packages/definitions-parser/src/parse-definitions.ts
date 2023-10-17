import { FS, LoggerWithErrors, filterNAtATimeOrdered, joinPaths, runWithChildProcesses } from "@definitelytyped/utils";
import { writeDataFile } from "./data-file";
import { getTypingInfo } from "./lib/definition-parser";
import { definitionParserWorkerFilename } from "./lib/definition-parser-worker";
import { AllPackages, readNotNeededPackages, typesDataFilename, TypingsVersionsRaw } from "./packages";

export interface ParallelOptions {
  readonly nProcesses: number;
  readonly definitelyTypedPath: string;
}

export async function parseDefinitions(
  dt: FS,
  parallel: ParallelOptions | undefined,
  log: LoggerWithErrors
): Promise<AllPackages> {
  log.info("Parsing definitions...");
  const typesFS = dt.subDir("types");
  const packageNames = await filterNAtATimeOrdered(
    parallel ? parallel.nProcesses : 1,
    typesFS.readdir(),
    (name) => typesFS.isDirectory(name) && typesFS.exists(joinPaths(name, "package.json"))
  );
  log.info(`Found ${packageNames.length} packages.`);

  const typings: { [name: string]: TypingsVersionsRaw } = {};
  const errors: string[] = [];

  const start = Date.now();
  if (parallel) {
    log.info(`Parsing in ${parallel.nProcesses} child process(es)...`);
    await runWithChildProcesses({
      inputs: packageNames,
      commandLineArgs: [`${parallel.definitelyTypedPath}/types`],
      workerFile: definitionParserWorkerFilename,
      nProcesses: parallel.nProcesses,
      handleOutput({ data, packageName }: { data: TypingsVersionsRaw | { errors: string[] }; packageName: string }) {
        if ("errors" in data) {
          errors.push(...data.errors);
        } else {
          typings[packageName] = data;
        }
      },
    });
  } else {
    const errors = [];
    log.info("Parsing in main process...");
    for (const packageName of packageNames) {
      const info = await getTypingInfo(packageName, dt);
      if ("errors" in info) {
        errors.push(...info.errors);
      } else {
        typings[packageName] = info;
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  log.info("Parsing took " + (Date.now() - start) / 1000 + " s");
  const sortedTypings = sorted(typings);
  await writeDataFile(typesDataFilename, sortedTypings);
  return AllPackages.from(sortedTypings, readNotNeededPackages(dt));
}

function sorted<T>(obj: { [name: string]: T }): { [name: string]: T } {
  const out: { [name: string]: T } = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = obj[key];
  }
  return out;
}
