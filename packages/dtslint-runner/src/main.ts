import os from "os";
import {
  execAndThrowErrors,
  joinPaths,
  nAtATime,
  loggerWithErrors,
  npmInstallFlags,
  installAllTypeScriptVersions,
  runWithListeningChildProcesses,
  CrashRecoveryState
} from "@definitelytyped/utils";
import { remove, readdir, readFileSync, pathExists } from "fs-extra";
import { RunDTSLintOptions } from "./types";
import { prepareAllPackages } from "./prepareAllPackages";
import { prepareAffectedPackages } from "./prepareAffectedPackages";
import { execSync } from "child_process";

export async function runDTSLint({
  definitelyTypedAcquisition,
  selection,
  noInstall,
  onlyTestTsNext,
  expectOnly,
  localTypeScriptPath,
  nProcesses = os.cpus().length,
  shard
}: RunDTSLintOptions) {
  if (definitelyTypedAcquisition.kind === "clone" && !noInstall) {
    await remove(joinPaths(process.cwd(), "DefinitelyTyped"));
    await cloneDefinitelyTyped(process.cwd(), definitelyTypedAcquisition.sha);
  }

  const definitelyTypedPath = joinPaths(
    process.cwd(),
    definitelyTypedAcquisition.kind === "clone" ? "" : "..",
    "DefinitelyTyped"
  );

  const typesPath = joinPaths(definitelyTypedPath, "types");

  const { packageNames, dependents } =
    selection === "all"
      ? await prepareAllPackages({ definitelyTypedPath, nProcesses, noInstall })
      : await prepareAffectedPackages({ definitelyTypedPath, nProcesses, noInstall });

  if (!onlyTestTsNext && !noInstall && !localTypeScriptPath) {
    await installAllTypeScriptVersions();
  }

  const allFailures: [string, string][] = [];
  const expectedFailures = new Set(
    (readFileSync(joinPaths(__dirname, "../expectedFailures.txt"), "utf8") as string)
      .split("\n")
      .filter(Boolean)
      .map(s => s.trim())
  );

  await runWithListeningChildProcesses({
    inputs: [...packageNames, ...dependents].map(path => ({
      path,
      onlyTestTsNext: onlyTestTsNext || !packageNames.includes(path),
      expectOnly: expectOnly || !packageNames.includes(path)
    })),
    commandLineArgs: localTypeScriptPath ? ["--listen", "--localTs", localTypeScriptPath] : ["--listen"],
    workerFile: require.resolve("dtslint"),
    nProcesses,
    cwd: typesPath,
    crashRecovery: true,
    crashRecoveryMaxOldSpaceSize: 0, // disable retry with more memory
    handleStart(input, processIndex) {
      const prefix = processIndex === undefined ? "" : `${processIndex}> `;
      console.log(`${prefix}${input.path} START`);
    },
    handleOutput(output, processIndex) {
      const prefix = processIndex === undefined ? "" : `${processIndex}> `;
      const { path, status } = output as { path: string; status: string };
      if (expectedFailures.has(path)) {
        if (status === "OK") {
          console.error(`${prefix}${path} passed, but was expected to fail.`);
          allFailures.push([path, status]);
        } else {
          console.error(`${prefix}${path} failed as expected:`);
          console.error(
            prefix
              ? status
                  .split(/\r?\n/)
                  .map(line => `${prefix}${line}`)
                  .join("\n")
              : status
          );
        }
      } else if (status === "OK") {
        console.log(`${prefix}${path} OK`);
        console.log(execSync("df -h /dev/sda1").toString());
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
      `git checkout ${sha}` // recent history, pull down some recent commits, then check it out
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
