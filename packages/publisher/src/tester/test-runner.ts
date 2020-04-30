import { existsSync, readFileSync } from "fs";
import { pathExists, remove } from "fs-extra";
import os = require("os");
import * as fold from "travis-fold";
import * as yargs from "yargs";
import { TesterOptions, defaultLocalOptions } from "../lib/common";
import {
  getDefinitelyTyped,
  AllPackages,
  TypingsData,
  getAffectedPackagesFromDiff,
  gitChanges,
  gitDiff
} from "@definitelytyped/definitions-parser";
import {
  CrashRecoveryState,
  execAndThrowErrors,
  joinPaths,
  logUncaughtErrors,
  runWithListeningChildProcesses,
  loggerWithErrors,
  consoleLogger,
  FS,
  npmInstallFlags,
  installAllTypeScriptVersions
} from "@definitelytyped/utils";

import { allDependencies, getAffectedPackages } from "@definitelytyped/definitions-parser";
import { numberOfOsProcesses } from "../util/util";

const perfDir = joinPaths(os.homedir(), ".dts", "perf");
const suggestionsDir = joinPaths(os.homedir(), ".dts", "suggestions");

if (!module.parent) {
  if (yargs.argv.affected) {
    logUncaughtErrors(testAffectedOnly(defaultLocalOptions));
  } else {
    const selection = yargs.argv.all ? "all" : yargs.argv._[0] ? new RegExp(yargs.argv._[0]) : "affected";
    const options = testerOptions(!!yargs.argv.runFromDefinitelyTyped);
    logUncaughtErrors(
      getDefinitelyTyped(options, loggerWithErrors()[0]).then(dt =>
        runTests(dt, options.definitelyTypedPath, parseNProcesses(), selection)
      )
    );
  }
}

async function testAffectedOnly(options: TesterOptions): Promise<void> {
  const changes = getAffectedPackages(
    await AllPackages.read(await getDefinitelyTyped(options, loggerWithErrors()[0])),
    gitChanges(await gitDiff(consoleLogger.info, options.definitelyTypedPath))
  );
  console.log({
    changedPackages: changes.changedPackages.map(t => t.desc),
    dependersLength: changes.dependentPackages.map(t => t.desc).length
  });
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
    : defaultLocalOptions;
}

export default async function runTests(
  dt: FS,
  definitelyTypedPath: string,
  nProcesses: number,
  selection: "all" | "affected" | RegExp
): Promise<void> {
  const { changedPackages, dependentPackages, allPackages } = await getAffectedPackagesFromDiff(
    dt,
    definitelyTypedPath,
    selection
  );
  console.log(`Running with ${nProcesses} processes.`);

  const typesPath = `${definitelyTypedPath}/types`;
  await doInstalls(allPackages, [...changedPackages, ...dependentPackages], typesPath);

  console.log("Testing...");
  await doRunTests([...changedPackages, ...dependentPackages], new Set(changedPackages), typesPath, nProcesses);
}

async function doInstalls(allPackages: AllPackages, packages: Iterable<TypingsData>, typesPath: string): Promise<void> {
  console.log("Installing NPM dependencies...");

  // We need to run `npm install` for all dependencies, too, so that we have dependencies' dependencies installed.
  for (const pkg of allDependencies(allPackages, packages)) {
    const cwd = directoryPath(typesPath, pkg);
    if (!(await pathExists(joinPaths(cwd, "package.json")))) {
      continue;
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
  }

  try {
    await installAllTypeScriptVersions();
  } catch (error) {
    console.error(error);
  }
}

function directoryPath(typesPath: string, pkg: TypingsData): string {
  return joinPaths(typesPath, pkg.subDirectoryPath);
}

async function doRunTests(
  packages: readonly TypingsData[],
  changed: ReadonlySet<TypingsData>,
  typesPath: string,
  nProcesses: number
): Promise<void> {
  await remove(suggestionsDir);
  const allFailures: [string, string][] = [];
  if (fold.isTravis()) {
    console.log(fold.start("tests"));
  }
  await runWithListeningChildProcesses({
    inputs: packages.map(p => ({
      path: p.subDirectoryPath,
      onlyTestTsNext: !changed.has(p),
      expectOnly: !changed.has(p)
    })),
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
      const { path, status } = output as { path: string; status: string };
      if (status === "OK") {
        console.log(`${prefix}${path} OK`);
      } else {
        console.error(`${prefix}${path} failing:`);
        console.error(
          prefix
            ? status
                .split(/\r?\n/)
                .map(line => `${prefix}${line}`)
                .join("\n")
            : status
        );
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
    }
  });
  if (fold.isTravis()) {
    console.log(fold.end("tests"));
  }

  console.log("\n\n=== SUGGESTIONS ===\n");
  const suggestionLines: string[] = [];
  for (const change of changed) {
    const pkgPath = change.versionDirectoryName ? change.name + change.versionDirectoryName : change.name;
    const path = joinPaths(suggestionsDir, pkgPath + ".txt");
    if (existsSync(path)) {
      const suggestions = readFileSync(path, "utf8").split("\n");
      suggestionLines.push(`"${change.subDirectoryPath}": [${suggestions.join(",")}]`);
    }
  }
  console.log(`{${suggestionLines.join(",")}}`);

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
