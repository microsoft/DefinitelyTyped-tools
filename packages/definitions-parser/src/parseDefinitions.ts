import { FS, LoggerWithErrors, filterNAtATimeOrdered, runWithChildProcesses } from "@definitelytyped/utils";
import { writeDataFile } from "./lib/common";
import { getTypingInfo } from "./lib/definition-parser";
import { definitionParserWorkerFilename } from "./lib/definition-parser-worker";
import { AllPackages, readNotNeededPackages, typesDataFilename, TypingsVersionsRaw } from "./lib/packages";

export interface ParallelOptions {
    readonly nProcesses: number;
    readonly definitelyTypedPath: string;
}

export default async function parseDefinitions(dt: FS, parallel: ParallelOptions | undefined, log: LoggerWithErrors): Promise<AllPackages> {
    log.info("Parsing definitions...");
    const typesFS = dt.subDir("types");
    const packageNames = await filterNAtATimeOrdered(parallel ? parallel.nProcesses : 1, typesFS.readdir(), name => typesFS.isDirectory(name));
    log.info(`Found ${packageNames.length} packages.`);

    const typings: { [name: string]: TypingsVersionsRaw } = {};

    const start = Date.now();
    if (parallel) {
        log.info("Parsing in parallel...");
        await runWithChildProcesses({
            inputs: packageNames,
            commandLineArgs: [`${parallel.definitelyTypedPath}/types`],
            workerFile: definitionParserWorkerFilename,
            nProcesses: parallel.nProcesses,
            handleOutput({ data, packageName}: { data: TypingsVersionsRaw, packageName: string }) {
                typings[packageName] = data;
            },
        });
    } else {
        log.info("Parsing non-parallel...");
        for (const packageName of packageNames) {
            typings[packageName] = getTypingInfo(packageName, typesFS.subDir(packageName));
        }
    }
    log.info("Parsing took " + ((Date.now() - start) / 1000) + " s");
    await writeDataFile(typesDataFilename, sorted(typings));
    return AllPackages.from(typings, readNotNeededPackages(dt));
}

function sorted<T>(obj: { [name: string]: T }): { [name: string]: T } {
    const out: { [name: string]: T } = {};
    for (const key of Object.keys(obj).sort()) {
        out[key] = obj[key];
    }
    return out;
}
