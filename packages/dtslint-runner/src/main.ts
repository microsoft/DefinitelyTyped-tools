import os from "os";
import { percentile } from "stats-lite";
import {
  execAndThrowErrors,
  joinPaths,
  runWithListeningChildProcesses,
  CrashRecoveryState,
  installAllTypeScriptVersions,
  installTypeScriptNext,
} from "@definitelytyped/utils";
import { remove, readFileSync, pathExists, readdirSync, existsSync } from "fs-extra";
import { RunDTSLintOptions } from "./types";
import { prepareAllPackages } from "./prepareAllPackages";
import { prepareAffectedPackages } from "./prepareAffectedPackages";
import { writeFileSync } from "fs";

const perfDir = joinPaths(os.homedir(), ".dts", "perf");
const suggestionsDir = joinPaths(os.homedir(), ".dts", "suggestions");

export async function runDTSLint({
  definitelyTypedAcquisition,
  onlyRunAffectedPackages = false,
  noInstall,
  onlyTestTsNext,
  expectOnly,
  localTypeScriptPath,
  nProcesses,
  shard,
  childRestartTaskInterval,
  writeFailures,
}: RunDTSLintOptions) {
  let definitelyTypedPath;
  console.log("Node version: ", process.version);
  if (definitelyTypedAcquisition.kind === "clone") {
    definitelyTypedPath = joinPaths(process.cwd(), "DefinitelyTyped");
    if (!noInstall) {
      await remove(definitelyTypedPath);
      await cloneDefinitelyTyped(process.cwd(), definitelyTypedAcquisition.sha);
    }
  } else {
    definitelyTypedPath = definitelyTypedAcquisition.path;
  }

  if (!(await pathExists(definitelyTypedPath))) {
    throw new Error(`Path '${definitelyTypedPath}' does not exist.`);
  }

  const typesPath = joinPaths(definitelyTypedPath, "types");

  const { packageNames, dependents } = onlyRunAffectedPackages
    ? await prepareAffectedPackages({ definitelyTypedPath, nProcesses, noInstall })
    : await prepareAllPackages({ definitelyTypedPath, nProcesses, noInstall });

  if (!noInstall && !localTypeScriptPath) {
    if (onlyTestTsNext) {
      await installTypeScriptNext();
    } else {
      await installAllTypeScriptVersions();
    }
  }

  const allFailures: [string, string][] = [];
  const expectedFailures = getExpectedFailures(onlyRunAffectedPackages, dependents);

  const allPackages = [...packageNames, ...dependents];
  const testedPackages = shard ? allPackages.filter((_, i) => i % shard.count === shard.id - 1) : allPackages;

  const dtslintArgs = [
    "--listen",
    ...(onlyTestTsNext ? ["--onlyTestTsNext"] : []),
    ...(localTypeScriptPath ? ["--localTs", localTypeScriptPath] : []),
  ];

  await runWithListeningChildProcesses({
    inputs: testedPackages.map((path) => ({
      path,
      onlyTestTsNext: onlyTestTsNext || !packageNames.includes(path),
      expectOnly: expectOnly || !packageNames.includes(path),
    })),
    commandLineArgs: dtslintArgs,
    workerFile: require.resolve("@definitelytyped/dtslint"),
    nProcesses,
    cwd: typesPath,
    crashRecovery: true,
    crashRecoveryMaxOldSpaceSize: 0, // disable retry with more memory
    childRestartTaskInterval,
    handleStart(input, processIndex) {
      const prefix = processIndex === undefined ? "" : `${processIndex}> `;
      console.log(`${prefix}${input.path} START`);
    },
    handleOutput(output, processIndex) {
      const prefix = processIndex === undefined ? "" : `${processIndex}> `;
      const { path, status } = output as { path: string; status: string };
      if (expectedFailures?.has(path)) {
        if (status === "OK") {
          console.error(`${prefix}${path} passed, but was expected to fail.`);
          allFailures.push([path, "Passed but was expected to fail."]);
        } else {
          console.error(`${prefix}${path} failed as expected:`);
          console.error(
            prefix
              ? status
                  .split(/\r?\n/)
                  .map((line) => `${prefix}${line}`)
                  .join("\n")
              : status
          );
        }
      } else if (status === "OK") {
        console.log(`${prefix}${path} OK`);
      } else {
        console.error(`${prefix}${path} failing:`);
        console.error(
          prefix
            ? status
                .split(/\r?\n/)
                .map((line) => `${prefix}${line}`)
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
          if (expectedFailures?.has(input.path)) {
            console.error(`${prefix}${input.path} failed as expected: out of memory.`);
          } else {
            console.error(`${prefix}${input.path} Out of memory: failed`);
            allFailures.push([input.path, "Out of memory"]);
          }
          break;
        default:
      }
    },
  });

  console.log("\n\n=== SUGGESTIONS ===\n");
  const suggestionLines: string[] = [];
  for (const packageName of packageNames) {
    const pkgPath = packageName.replace("/", ""); // react/v15 -> reactv15
    const path = joinPaths(suggestionsDir, pkgPath + ".txt");
    if (await pathExists(path)) {
      const suggestions = readFileSync(path, "utf8").split("\n");
      suggestionLines.push(`"${packageName}": [${suggestions.join(",")}]`);
    }
  }
  console.log(`{${suggestionLines.join(",")}}`);

  logPerformance();

  if (writeFailures) {
    writeFileSync(writeFailures, JSON.stringify(allFailures.map(([path, error]) => ({ path, error }))), "utf8");
  }

  if (allFailures.length === 0) {
    return 0;
  }

  console.error("\n\n=== ERRORS ===\n");
  for (const [path, error] of allFailures) {
    console.error(`\n\nError in ${path}`);
    console.error(error);
  }

  return allFailures.length;
}

function getExpectedFailures(onlyRunAffectedPackages: boolean, dependents: readonly string[]) {
  return new Set(
    (readFileSync(joinPaths(__dirname, "../expectedFailures.txt"), "utf8") as string)
      .split("\n")
      .map((s) => s.trim())
      .filter(onlyRunAffectedPackages ? (line) => line && dependents.includes(line) : Boolean)
  );
}

async function cloneDefinitelyTyped(cwd: string, sha: string | undefined): Promise<void> {
  if (sha) {
    const cmd = "git init DefinitelyTyped";
    console.log(cmd);
    await execAndThrowErrors(cmd, cwd);
    cwd = `${cwd}/DefinitelyTyped`;
    const commands = [
      "git remote add origin https://github.com/DefinitelyTyped/DefinitelyTyped.git",
      "git fetch origin master --depth 50", // We can't clone the commit directly, so assume the commit is from
      `git checkout ${sha}`, // recent history, pull down some recent commits, then check it out
    ];
    for (const command of commands) {
      console.log(command);
      await execAndThrowErrors(command, cwd);
    }
  } else {
    const cmd = "git clone https://github.com/DefinitelyTyped/DefinitelyTyped.git --depth 1";
    console.log(cmd);
    await execAndThrowErrors(cmd, cwd);
  }
}

function logPerformance() {
  const big: [string, number][] = [];
  const types: number[] = [];
  if (existsSync(perfDir)) {
    console.log("\n\n=== PERFORMANCE ===\n");
    for (const filename of readdirSync(perfDir, { encoding: "utf8" })) {
      const x = JSON.parse(readFileSync(joinPaths(perfDir, filename), { encoding: "utf8" })) as {
        [s: string]: { types: number; memory: number };
      };
      for (const k of Object.keys(x)) {
        big.push([k, x[k].types]);
        types.push(x[k].types);
      }
    }

    console.log("  * Percentiles: ");
    console.log("99:", percentile(types, 0.99));
    console.log("95:", percentile(types, 0.95));
    console.log("90:", percentile(types, 0.9));
    console.log("70:", percentile(types, 0.7));
    console.log("50:", percentile(types, 0.5));
  }
}
