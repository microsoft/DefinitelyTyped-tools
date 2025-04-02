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
import { resolve } from "path";

export async function runDTSLint({
  definitelyTypedAcquisition,
  onlyRunAffectedPackages = false,
  noInstall,
  onlyTestTsNext,
  skipNpmChecks,
  onlyNpmChecks,
  expectOnly,
  localTypeScriptPath,
  nProcesses,
  shard,
  childRestartTaskInterval,
  writeFailures,
  diffBase,
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
  definitelyTypedPath = resolve(definitelyTypedPath);

  if (!fs.existsSync(definitelyTypedPath)) {
    throw new Error(`Path '${definitelyTypedPath}' does not exist.`);
  }

  const typesPath = joinPaths(definitelyTypedPath, "types");

  const { packageNames, dependents, attwChanges } = onlyRunAffectedPackages
    ? await prepareAffectedPackages(definitelyTypedPath, diffBase)
    : await prepareAllPackages(definitelyTypedPath, definitelyTypedAcquisition.kind === "clone");

  const allFailures: [string, string][] = [];
  const allWarnings: [string, string][] = [];
  const expectedFailures = getExpectedFailures(onlyRunAffectedPackages, dependents);

  const allPackages = [...packageNames, ...attwChanges, ...dependents];
  const testedPackages = getTestedPackages(shard, allPackages);

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
      npmChecks: onlyNpmChecks || attwChanges.has(path) ? "only" : expectOnly || skipNpmChecks ? false : true,
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
      const { path, status, warnings } = output as { path: string; status: string; warnings: string | undefined };
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
        console.log(`${prefix}${path} OK${warnings ? ` (with warnings)` : ""}`);
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
      if (warnings) {
        allWarnings.push([path, warnings]);
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

  if (allWarnings.length) {
    console.log("\n\n=== WARNINGS ===\n");
    for (const [path, warnings] of allWarnings) {
      console.log(`\n\nWarnings in ${path}`);
      console.log(warnings);
    }
  }

  if (allFailures.length) {
    console.log("\n\n=== ERRORS ===\n");
    for (const [path, error] of allFailures) {
      console.log(`\n\nError in ${path}`);
      console.log(error);
    }
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

  const cloneCmd: Command = [
    "git",
    ["clone", "--filter", "blob:none", "https://github.com/DefinitelyTyped/DefinitelyTyped.git"],
  ];
  console.log(`${cloneCmd[0]} ${cloneCmd[1].join(" ")}`);
  await execAndThrowErrors(cloneCmd[0], cloneCmd[1], cwd);

  if (sha) {
    cwd = `${cwd}/DefinitelyTyped`;

    const fetchCmd: Command = ["git", ["fetch", "origin", sha]];
    console.log(`${fetchCmd[0]} ${fetchCmd[1].join(" ")}`);
    await execAndThrowErrors(fetchCmd[0], fetchCmd[1], cwd);

    const switchCmd: Command = ["git", ["switch", "--detach", "FETCH_HEAD"]];
    console.log(`${switchCmd[0]} ${switchCmd[1].join(" ")}`);
    await execAndThrowErrors(switchCmd[0], switchCmd[1], cwd);
  }
}

function getTestedPackages(shard: { id: number; count: number } | undefined, packages: string[]) {
  if (!shard) {
    return packages;
  }

  // When sharding packages, keep versioned packages together to avoid failing
  // multiple CI jobs on issues that affect all versions of a package.

  const groups = new Map<string, string[]>();

  for (const pkg of packages) {
    const prefix = pkg.split("/")[0];
    const group = groups.get(prefix);
    if (group) {
      group.push(pkg);
    } else {
      groups.set(prefix, [pkg]);
    }
  }

  const shardedPackages: string[] = [];

  let i = 0;
  for (const group of groups.values()) {
    if (i % shard.count === shard.id - 1) {
      shardedPackages.push(...group);
    }
    i++;
  }

  return shardedPackages;
}
