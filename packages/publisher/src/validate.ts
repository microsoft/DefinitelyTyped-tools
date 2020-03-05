import { mkdirp, remove } from "fs-extra";
import * as yargs from "yargs";

import { getDefinitelyTyped, AllPackages, getFullNpmName } from "@definitelytyped/definitions-parser";
import { defaultLocalOptions } from "./lib/common";
import { validateOutputPath } from "./lib/settings";
import { readChangedPackages } from "./lib/versions";
import { exec, joinPaths, logUncaughtErrors, nAtATime, loggerWithErrors, FS, writeLog, LoggerWithErrors, quietLoggerWithErrors, moveLogsWithErrors, writeJson, writeFile } from "@definitelytyped/utils";

if (!module.parent) {
    const all = !!yargs.argv.all;
    const packageNames = yargs.argv._;
    if (all && packageNames.length) {
        throw new Error("Can't combine --all with listed package names.");
    }

    if (all) {
        console.log("Validating all packages");
        logUncaughtErrors(doAll());
    } else if (packageNames.length) {
        console.log(`Validating: ${JSON.stringify(packageNames)}`);
        logUncaughtErrors(doValidate(packageNames));
    } else {
        const log = loggerWithErrors()[0];
        logUncaughtErrors(getDefinitelyTyped(defaultLocalOptions, log).then(validate));
    }
}

export default async function validate(dt: FS): Promise<void> {
    await doValidate((await readChangedPackages(await AllPackages.read(dt))).changedTypings.map(c => c.pkg.name));
}

async function doAll(): Promise<void> {
    // todo: validate older versions too
    const packageNames = (await AllPackages.readTypings()).map(t => t.name).sort();
    await doValidate(packageNames);
}

async function doValidate(packageNames: ReadonlyArray<string>): Promise<void> {
    const [log, logResult] = loggerWithErrors();
    await validatePackages(packageNames, validateOutputPath, log);
    const {infos, errors} = logResult();
    await Promise.all([
        writeLog("validate.md", infos),
        writeLog("validate-errors.md", errors),
    ]);
}

async function validatePackages(packageNames: ReadonlyArray<string>, outPath: string, log: LoggerWithErrors): Promise<void> {
    log.info("");
    log.info(`Using output path: ${outPath}`);
    log.info("Running tests....");
    log.info("");
    const failed: string[] = [];
    const passed: string[] = [];
    try {
        await remove(outPath);
        await mkdirp(outPath);
    } catch (e) {
        log.error(`Could not recreate output directory. ${e}`);
        return;
    }

    // Run the tests
    await nAtATime(25, packageNames, async packageName => {
        if (await validatePackage(packageName, outPath, log)) {
            passed.push(packageName);
        } else {
            failed.push(packageName);
        }
    });

    // Write results
    log.info("");
    log.info("");
    log.info(`Total  ${packageNames.length}`);
    log.info(`Passed ${passed.length}`);
    log.info(`Failed ${failed.length}`);
    log.info("");

    if (failed.length) {
        log.info(`These packages failed: ${failed.toString()}`);
    }
}

async function validatePackage(packageName: string, outputDirecory: string, mainLog: LoggerWithErrors): Promise<boolean> {
    const [log, logResult] = quietLoggerWithErrors();
    let passed = false;
    try {
        const packageDirectory = joinPaths(outputDirecory, packageName);
        log.info("");
        log.info(`Processing \`${packageName}\`...`);
        await mkdirp(packageDirectory);
        await writePackage(packageDirectory, packageName);
        if (await runCommand("npm", log, packageDirectory, "../../node_modules/npm/bin/npm-cli.js", "install") &&
            await runCommand("tsc", log, packageDirectory, "../../node_modules/typescript/lib/tsc.js")) {
            await remove(packageDirectory);
            log.info("Passed.");
            passed = true;
        }
    } catch (e) {
        log.info(`Error: ${e}`);
        log.info("Failed!");
    }

    // Write the log as one entry to the main log
    moveLogsWithErrors(mainLog, logResult());

    console.info(`${packageName} -- ${passed ? "Passed" : "Failed"}.`);
    return passed;
}

async function writePackage(packageDirectory: string, packageName: string): Promise<void> {
    // Write package.json
    await writeJson(joinPaths(packageDirectory, "package.json"), {
        name: `${packageName}_test`,
        version: "1.0.0",
        description: "test",
        author: "",
        license: "ISC",
        repository: "https://github.com/Microsoft/types-publisher",
        dependencies: { [getFullNpmName(packageName)]: "latest" },
    });

    // Write tsconfig.json
    await writeJson(joinPaths(packageDirectory, "tsconfig.json"), {
        compilerOptions: {
            module: "commonjs",
            target: "es5",
            noImplicitAny: false,
            strictNullChecks: false,
            noEmit: true,
            lib: ["es5", "es2015.promise", "dom"],
        },
    });

    // Write index.ts
    await writeFile(joinPaths(packageDirectory, "index.ts"), `/// <reference types="${packageName}" />\r\n`);
}

// Returns whether the command succeeded.
async function runCommand(commandDescription: string, log: LoggerWithErrors, directory: string, cmd: string, ...args: string[]): Promise<boolean> {
    const nodeCmd = `node ${cmd} ${args.join(" ")}`;
    log.info(`Run ${nodeCmd}`);
    const { error, stdout, stderr } = await exec(nodeCmd, directory);
    if (error) {
        log.error(stderr);
        log.info(stdout);
        log.error(`${commandDescription} failed: ${JSON.stringify(error)}`);
        log.info(`${commandDescription} failed, refer to error log`);
        return false;
    }
    log.info(stdout);
    return true;
}
