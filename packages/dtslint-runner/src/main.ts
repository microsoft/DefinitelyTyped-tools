import {
  execAndThrowErrors,
  joinPaths,
  runWithListeningChildProcesses,
  suggestionsDir,
  CrashRecoveryState,
} from "@definitelytyped/utils";
import fs from "fs";
import { RunDTSLintOptions } from "./types";
import { prepareAllPackages } from "./prepareAllPackages";
import { prepareAffectedPackages } from "./prepareAffectedPackages";

export async function runDTSLint({
  definitelyTypedAcquisition,
  onlyRunAffectedPackages = false,
  noInstall,
  onlyTestTsNext,
  skipNpmChecks,
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
      await fs.promises.rm(definitelyTypedPath, { recursive: true, force: true });
      await cloneDefinitelyTyped(process.cwd(), definitelyTypedAcquisition.sha);
    }
  } else {
    definitelyTypedPath = definitelyTypedAcquisition.path;
  }

  if (!fs.existsSync(definitelyTypedPath)) {
    throw new Error(`Path '${definitelyTypedPath}' does not exist.`);
  }

  const typesPath = joinPaths(definitelyTypedPath, "types");

  const { packageNames, dependents } = onlyRunAffectedPackages
    ? await prepareAffectedPackages(definitelyTypedPath)
    : await prepareAllPackages(definitelyTypedPath, definitelyTypedAcquisition.kind === "clone");

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
      onlyTestTsNext,
      expectOnly,
      skipNpmChecks: skipNpmChecks || !packageNames.has(path),
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
              : status,
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
            : status,
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
    if (fs.existsSync(path)) {
      const suggestions = fs.readFileSync(path, "utf8").split("\n");
      suggestionLines.push(`"${packageName}": [${suggestions.join(",")}]`);
    }
  }
  console.log(`{${suggestionLines.join(",")}}`);

  if (writeFailures) {
    fs.writeFileSync(writeFailures, JSON.stringify(allFailures.map(([path, error]) => ({ path, error }))), "utf8");
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

function getExpectedFailures(onlyRunAffectedPackages: boolean, dependents: Set<string>) {
  return new Set(
    (fs.readFileSync(joinPaths(__dirname, "../expectedFailures.txt"), "utf8") as string)
      .split("\n")
      .map((s) => s.trim())
      .filter(onlyRunAffectedPackages ? (line) => line && dependents.has(line) : Boolean),
  );
}

async function cloneDefinitelyTyped(cwd: string, sha: string | undefined): Promise<void> {
  type Command = [string, string[]];
  if (sha) {
    const cmd: Command = ["git", ["init", "DefinitelyTyped"]];
    console.log(`${cmd[0]} ${cmd[1].join(" ")}`);
    await execAndThrowErrors(cmd[0], cmd[1], cwd);
    cwd = `${cwd}/DefinitelyTyped`;
    const commands: Command[] = [
      ["git", ["remote", "add", "origin", "https://github.com/DefinitelyTyped/DefinitelyTyped.git"]],
      ["git", ["fetch", "origin", "master", "--depth", "50"]], // We can't clone the commit directly, so assume the commit is from
      ["git", ["checkout", sha]], // recent history, pull down some recent commits, then check it out
    ];
    for (const cmd of commands) {
      console.log(`${cmd[0]} ${cmd[1].join(" ")}`);
      await execAndThrowErrors(cmd[0], cmd[1], cwd);
    }
  } else {
    const cmd: Command = ["git", ["clone", "https://github.com/DefinitelyTyped/DefinitelyTyped.git", "--depth", "1"]];
    console.log(`${cmd[0]} ${cmd[1].join(" ")}`);
    await execAndThrowErrors(cmd[0], cmd[1], cwd);
  }
}
