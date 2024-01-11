#!/usr/bin/env node

import os from "os";
import yargs from "yargs";
import { RunDTSLintOptions } from "./types";
import { runDTSLint } from "./main";
import { assertDefined, logUncaughtErrors } from "@definitelytyped/utils";

export { runDTSLint, RunDTSLintOptions };

if (require.main === module) {
  const args = yargs
    .options({
      clone: {
        group: "DefinitelyTyped acquisition",
        description: "Clone DefinitelyTyped before running. Can be used as a boolean flag or set to the SHA to clone.",
        conflicts: "path",
      },
      path: {
        group: "DefinitelyTyped acquisition",
        description: "Path to local DefinitelyTyped clone.",
        conflicts: "clone",
        type: "string",
      },
      selection: {
        group: "Package selection",
        description: "Which packages to test.",
        type: "string",
        choices: ["all", "affected"],
        default: "affected",
      },
      nProcesses: {
        group: "Parallelism",
        description: "How many processes to distribute parallelizable tasks over.",
        type: "number",
        default: os.cpus().length,
      },
      shardId: {
        group: "Parallelism",
        description: "The machine index when sharding a run over multiple machines.",
        type: "number",
        implies: "shardCount",
      },
      shardCount: {
        group: "Parallelism",
        description: "The total number of machines when sharding a run over multiple machines.",
        type: "number",
        implies: "shardId",
      },
      localTypeScriptPath: {
        group: "dtslint options",
        description:
          "Path to local TypeScript installation to be used by dtslint instead of all supported TypeScript versions.",
        type: "string",
        conflicts: "onlyTestTsNext",
      },
      onlyTestTsNext: {
        group: "dtslint options",
        description: "Run dtslint only with typescript@next instead of all supported TypeScript versions.",
        type: "boolean",
        conflicts: "localTypeScriptPath",
      },
      expectOnly: {
        group: "dtslint options",
        description: "Run only the expect lint rule.",
        type: "boolean",
        default: false,
      },
      skipNpmNaming: {
        group: "dtslint options",
        description: "Skip the npm-naming lint rule.",
        type: "boolean",
        default: false,
      },
      // Only useful for repeated local runs, so I’m hiding it
      noInstall: {
        hidden: true,
        type: "boolean",
        default: false,
      },
      childRestartTaskInterval: {
        type: "number",
        description:
          "How often to restart child processes, in number of tasks. Useful to work around memory leaks. Default is not to restart.",
      },
      writeFailures: {
        type: "string",
        description: "Path to which all failures will be written.",
        default: "",
      },
    })
    .wrap(Math.min(yargs.terminalWidth(), 120))
    .parseSync();

  const options: RunDTSLintOptions = {
    definitelyTypedAcquisition: args.clone
      ? {
          kind: "clone",
          sha: typeof args.clone === "string" ? args.clone : undefined,
        }
      : {
          kind: "local",
          path: args.path || "../DefinitelyTyped",
        },
    onlyRunAffectedPackages: args.selection === "affected",
    nProcesses: args.nProcesses,
    shard: args.shardCount ? { id: assertDefined(args.shardId), count: args.shardCount } : undefined,
    localTypeScriptPath: !args.onlyTestTsNext ? args.localTypeScriptPath : undefined,
    onlyTestTsNext: !!args.onlyTestTsNext,
    expectOnly: args.expectOnly,
    skipNpmNaming: args.skipNpmNaming,
    noInstall: args.noInstall,
    childRestartTaskInterval: args.childRestartTaskInterval,
    writeFailures: args.writeFailures,
  };

  logUncaughtErrors(async () => {
    console.log(`dtslint-runner@${require("../package.json").version}`);
    const failures = await runDTSLint(options);
    process.exit(failures);
  });
}
