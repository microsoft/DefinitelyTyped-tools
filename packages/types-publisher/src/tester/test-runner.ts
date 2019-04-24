import assert = require("assert");
import { pathExists } from "fs-extra";
import os = require("os");
import { existsSync, readFileSync } from "fs";
import * as fold from "travis-fold";
import * as yargs from "yargs";

import { Semver } from "../lib/versions";
import { parseMajorVersionFromDirectoryName } from "../lib/definition-parser";
import { sourceBranch, typesDirectoryName } from "../lib/settings";
import { FS, getDefinitelyTyped } from "../get-definitely-typed";
import { Options, TesterOptions } from "../lib/common";
import { AllPackages, DependencyVersion, PackageId, TypingsData, NotNeededPackage } from "../lib/packages";
import { UncachedNpmInfoClient, NpmInfo } from "../lib/npm-client";
import { npmInstallFlags } from "../util/io";
import { consoleLogger, Logger, LoggerWithErrors, loggerWithErrors } from "../util/logging";
import { assertDefined, exec, execAndThrowErrors, flatMap, joinPaths, logUncaughtErrors, mapIter, nAtATime, numberOfOsProcesses, runWithListeningChildProcesses, CrashRecoveryState } from "../util/util";

import { getAffectedPackages, Affected, allDependencies } from "./get-affected-packages";

const perfDir = joinPaths(os.homedir(), ".dts", "perf");

if (!module.parent) {
    if (yargs.argv.affected) {
        logUncaughtErrors(testAffectedOnly(Options.defaults));
    }
    else {
        const selection = yargs.argv.all ? "all" : yargs.argv._[0] ? new RegExp(yargs.argv._[0]) : "affected";
        const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
        logUncaughtErrors(
            getDefinitelyTyped(options, loggerWithErrors()[0]).then(dt => runTests(dt, options.definitelyTypedPath, parseNProcesses(), selection)));
    }
}

export interface GitDiff {
    status: "A" | "D" | "M";
    file: string
}

async function testAffectedOnly(options: TesterOptions): Promise<void> {
    const changes = getAffectedPackages(
        await AllPackages.read(await getDefinitelyTyped(options, loggerWithErrors()[0])),
        gitChanges(await gitDiff(consoleLogger.info, options.definitelyTypedPath)));
    console.log({ changedPackages: changes.changedPackages.map(t => t.desc), dependersLength: changes.dependentPackages.map(t => t.desc).length });
}

export function parseNProcesses(): number {
    const str = yargs.argv.nProcesses as string | undefined;
    if (!str) {
        return numberOfOsProcesses;
    }
    const nProcesses = Number.parseInt(str, 10);
    if (Number.isNaN(nProcesses)) {
        throw new Error("Expected nProcesses to be a number.");
    }
    return nProcesses;
}

export function testerOptions(runFromDefinitelyTyped: boolean): TesterOptions {
    return runFromDefinitelyTyped
        ? { definitelyTypedPath: process.cwd(), progress: false, parseInParallel: true }
        : Options.defaults;
}

export default async function runTests(
    dt: FS,
    definitelyTypedPath: string,
    nProcesses: number,
    selection: "all" | "affected" | RegExp,
): Promise<void> {
    const allPackages = await AllPackages.read(dt);
    const diffs = await gitDiff(consoleLogger.info, definitelyTypedPath);
    if (diffs.find(d => d.file === "notNeededPackages.json")) {
        const uncached = new UncachedNpmInfoClient()
        for (const deleted of getNotNeededPackages(allPackages, diffs)) {
            const source = await uncached.fetchNpmInfo(deleted.libraryName) // eg @babel/parser
            const typings = await uncached.fetchNpmInfo(deleted.fullNpmName) // eg @types/babel__parser
            checkNotNeededPackage(deleted, source, typings);
        }
    }
    const { changedPackages, dependentPackages }: Affected =
        selection === "all" ? { changedPackages: allPackages.allTypings(), dependentPackages: [] } :
        selection === "affected" ? getAffectedPackages(allPackages, gitChanges(diffs))
        : { changedPackages: allPackages.allTypings().filter(t => selection.test(t.name)), dependentPackages: [] };

    console.log(`Testing ${changedPackages.length} changed packages: ${changedPackages.map(t => t.desc)}`);
    console.log(`Testing ${dependentPackages.length} dependent packages: ${dependentPackages.map(t => t.desc)}`);
    console.log(`Running with ${nProcesses} processes.`);

    const typesPath = `${definitelyTypedPath}/types`;
    await doInstalls(allPackages, [...changedPackages, ...dependentPackages], typesPath, nProcesses);

    console.log("Testing...");
    await doRunTests([...changedPackages, ...dependentPackages], new Set(changedPackages), typesPath, nProcesses);
}

/**
 * 1. find all the deleted files and group by toplevel
 * 2. Make sure that there are no packages left with deleted entries
 * 3. make sure that each toplevel deleted has a matching entry in notNeededPackages
 */
export function getNotNeededPackages(allPackages: AllPackages, diffs: GitDiff[]): Iterable<NotNeededPackage> {
    const deletedPackages = new Set(diffs.filter(d => d.status === "D").map(d =>
        assertDefined(getDependencyFromFile(d.file),
            `Unexpected file deleted: ${d.file}
When removing packages, you should only delete files that are a part of removed packages.`)
        .name));
    return mapIter(deletedPackages, p => {
        if (allPackages.hasTypingFor({ name: p, majorVersion: "*" })) {
            throw new Error(`Please delete all files in ${p} when adding it to notNeededPackages.json.`);
        }
        return assertDefined(allPackages.getNotNeededPackage(p), `Deleted package ${p} is not in notNeededPackages.json.`);
    });
}

/**
 * 1. libraryName must exist on npm (SKIPPED and preferably/optionally have been the libraryName in just-deleted header)
 * (SKIPPED 2.) sourceRepoURL must exist and be the npm homepage
 * 3. asOfVersion must be newer than `@types/name@latest` on npm
 * 4. `name@asOfVersion` must exist on npm
 *
 * I skipped (2) because the cached npm info doesn't include it. I might add it later.
 */
export function checkNotNeededPackage(unneeded: NotNeededPackage, source: NpmInfo | undefined, typings: NpmInfo | undefined) {
    source = assertDefined(source, `The entry for ${unneeded.fullNpmName} in notNeededPackages.json has
"libraryName": "${unneeded.libraryName}", but there is no npm package with this name.
Unneeded packages have to be replaced with a package on npm.`);
    typings = assertDefined(typings, `Unexpected error: @types package not found for ${unneeded.fullNpmName}`);
    const latestTypings = Semver.parse(assertDefined(typings.distTags.get("latest"), `Unexpected error: ${unneeded.fullNpmName} is missing the "latest" tag.`));
    assert(unneeded.version.greaterThan(latestTypings), `The specified version ${unneeded.version.versionString} of ${unneeded.libraryName} must be newer than the version
it is supposed to replace, ${latestTypings.versionString} of ${unneeded.fullNpmName}.`);
    assert(source.versions.has(unneeded.version.versionString), `The specified version ${unneeded.version.versionString} of ${unneeded.libraryName} is not on npm.`);
}

async function doInstalls(allPackages: AllPackages, packages: Iterable<TypingsData>, typesPath: string, nProcesses: number): Promise<void> {
    console.log("Installing NPM dependencies...");

    // We need to run `npm install` for all dependencies, too, so that we have dependencies' dependencies installed.
    await nAtATime(nProcesses, allDependencies(allPackages, packages), async pkg => {
        const cwd = directoryPath(typesPath, pkg);
        if (!await pathExists(joinPaths(cwd, "package.json"))) {
            return;
        }

        // Scripts may try to compile native code.
        // This doesn't work reliably on travis, and we're just installing for the types, so ignore.
        const cmd = `npm install ${npmInstallFlags}`;
        console.log(`  ${cwd}: ${cmd}`);
        const stdout = await execAndThrowErrors(cmd, cwd);
        if (stdout) {
            // Must specify what this is for since these run in parallel.
            console.log(` from ${cwd}: ${stdout}`);
        }
    });

    await runCommand(console, undefined, require.resolve("dtslint"), ["--installAll"]);
}

function directoryPath(typesPath: string, pkg: TypingsData): string {
    return joinPaths(typesPath, pkg.subDirectoryPath);
}

async function doRunTests(
    packages: ReadonlyArray<TypingsData>,
    changed: ReadonlySet<TypingsData>,
    typesPath: string,
    nProcesses: number,
): Promise<void> {
    const allFailures: Array<[string, string]> = [];
    if (fold.isTravis()) { console.log(fold.start("tests")); }
    await runWithListeningChildProcesses({
        inputs: packages.map(p => ({ path: p.subDirectoryPath, onlyTestTsNext: !changed.has(p), expectOnly: !changed.has(p) })),
        commandLineArgs: ["--listen"],
        workerFile: require.resolve("dtslint"),
        nProcesses,
        crashRecovery: true,
        crashRecoveryMaxOldSpaceSize: 0, // disable retry with more memory
        cwd: typesPath,
        handleStart(input, processIndex): void {
            const prefix = processIndex === undefined ? "" : `${processIndex}> `;
            console.log(`${prefix}${input.path} START`);
        },
        handleOutput(output, processIndex): void {
            const prefix = processIndex === undefined ? "" : `${processIndex}> `;
            const { path, status } = output as { path: string, status: string };
            if (status === "OK") {
                console.log(`${prefix}${path} OK`);
            } else {
                console.error(`${prefix}${path} failing:`);
                console.error(prefix ? status.split(/\r?\n/).map(line => `${prefix}${line}`).join("\n") : status);
                allFailures.push([path, status]);
            }
        },
        handleCrash(input, state, processIndex) {
            const prefix = processIndex === undefined ? "" : `${processIndex}> `;
            switch (state) {
                case CrashRecoveryState.Retry:
                    console.warn(`${prefix}${input.path} Out of memory: retrying`);
                    break;
                case CrashRecoveryState.RetryWithMoreMemory:
                    console.warn(`${prefix}${input.path} Out of memory: retrying with increased memory (4096M)`);
                    break;
                case CrashRecoveryState.Crashed:
                    console.error(`${prefix}${input.path} Out of memory: failed`);
                    allFailures.push([input.path, "Out of memory"]);
                    break;
                default:
            }
        },
    });
    if (fold.isTravis()) { console.log(fold.end("tests")); }

    console.log("\n\n=== PERFORMANCE ===\n");
    console.log("{");
    for (const change of changed) {
        const path = joinPaths(perfDir, change.name + ".json");
        if (existsSync(path)) {
            const perf = JSON.parse(readFileSync(path, "utf8")) as { [name: string]: { typeCount: number } };
            console.log(`  "${change.name}": ${perf[change.name].typeCount},`);
        }
    }
    console.log("}");

    if (allFailures.length === 0) {
        return;
    }

    console.error("\n\n=== ERRORS ===\n");

    for (const [path, error] of allFailures) {
        console.error(`\n\nError in ${path}`);
        console.error(error);
    }

    throw new Error(`The following packages had errors: ${allFailures.map(e => e[0]).join(", ")}`);
}

interface TesterError {
    message: string;
}

async function runCommand(log: LoggerWithErrors, cwd: string | undefined, cmd: string, args: string[]): Promise<TesterError | undefined> {
    const nodeCmd = `node ${cmd} ${args.join(" ")}`;
    log.info(`Running: ${nodeCmd}`);
    try {
        const { error, stdout, stderr } = await exec(nodeCmd, cwd);
        if (stdout) {
            log.info(stdout);
        }
        if (stderr) {
            log.error(stderr);
        }

        return error && { message: `${error.message}\n${stdout}\n${stderr}` };
    } catch (e) {
        return e as TesterError;
    }
}


/** Returns all immediate subdirectories of the root directory that have changed. */
export function gitChanges(diffs: GitDiff[]): PackageId[] {
    const changedPackages = new Map<string, Set<DependencyVersion>>();

    for (const diff of diffs) {
        const dep = getDependencyFromFile(diff.file);
        if (dep) {
            const versions = changedPackages.get(dep.name);
            if (!versions) {
                changedPackages.set(dep.name, new Set([dep.majorVersion]));
            } else {
                versions.add(dep.majorVersion);
            }
        }
    }

    return Array.from(flatMap(changedPackages, ([name, versions]) =>
        mapIter(versions, majorVersion => ({ name, majorVersion }))));
}

/*
We have to be careful about how we get the diff because travis uses a shallow clone.

Travis runs:
    git clone --depth=50 https://github.com/DefinitelyTyped/DefinitelyTyped.git DefinitelyTyped
    cd DefinitelyTyped
    git fetch origin +refs/pull/123/merge
    git checkout -qf FETCH_HEAD

If editing this code, be sure to test on both full and shallow clones.
*/
export async function gitDiff(log: Logger, definitelyTypedPath: string): Promise<GitDiff[]> {
    try {
        await run(`git rev-parse --verify ${sourceBranch}`);
        // If this succeeds, we got the full clone.
    } catch (_) {
        // This is a shallow clone.
        await run(`git fetch origin ${sourceBranch}`);
        await run(`git branch ${sourceBranch} FETCH_HEAD`);
    }

    let diff = (await run(`git diff ${sourceBranch} --name-status`)).trim();
    if (diff === "") {
        // We are probably already on master, so compare to the last commit.
        diff = (await run(`git diff ${sourceBranch}~1 --name-status`)).trim();
    }
    return diff.split("\n").map(line => {
        var [status, file] = line.split(/\s+/, 2);
        return { status: status.trim(), file: file.trim() } as GitDiff;
    });

    async function run(cmd: string): Promise<string> {
        log(`Running: ${cmd}`);
        const stdout = await execAndThrowErrors(cmd, definitelyTypedPath);
        log(stdout);
        return stdout;
    }
}

/**
 * For "types/a/b/c", returns { name: "a", version: "*" }.
 * For "types/a/v3/c", returns { name: "a", version: 3 }.
 * For "x", returns undefined.
 */
function getDependencyFromFile(file: string): PackageId | undefined {
    const parts = file.split("/");
    if (parts.length <= 2) {
        // It's not in a typings directory at all.
        return undefined;
    }

    const [typesDirName, name, subDirName] = parts; // Ignore any other parts

    if (typesDirName !== typesDirectoryName) {
        return undefined;
    }

    if (subDirName) {
        // Looks like "types/a/v3/c"
        const majorVersion = parseMajorVersionFromDirectoryName(subDirName);
        if (majorVersion !== undefined) {
            return { name,  majorVersion };
        }
    }

    return { name, majorVersion: "*" };
}
