import os from "os";
import path from "path";
import process from "process";
import yargs from "yargs";
import { benchmark } from "./benchmark";
import { getPackagesToBenchmark } from "./getPackagesToBenchmark";
import { compare } from "./compare";
import { compareTypeScriptCLI } from "./compareTypeScript";
import { parsePackageKey } from "../common";

const maxRunSeconds = {
  type: "number",
  requiresArg: true,
  description: "limits the total run time of the benchmark"
} as const;

const upload = {
  type: "boolean",
  description: "uploads benchmark results to a database",
  default: true
} as const;

const file = {
  type: "string",
  requiresArg: true,
  description: "a path to a JSON file specifying run options"
} as const;

const definitelyTypedPath = {
  type: "string",
  requiresArg: true,
  description: "the directory of the DefinitelyTyped repository",
  default: process.cwd()
} as const;

const localTypeScriptPath = {
  type: "string",
  description: "path to a locally built TypeScript installation",
  default: path.resolve("built/local")
} as const;

const tsVersion = {
  type: "string",
  description: "the TypeScript major/minor version to use for the measurements",
  default: "next"
} as const;

void yargs
  .command(
    "benchmark",
    "benchmark a single package",
    {
      file,
      upload,
      tsVersion,
      progress: {
        type: "boolean",
        description: "logs progress updates during benchmarking",
        default: false
      },
      iterations: {
        type: "number",
        requiresArg: true,
        description: "the number of times to measure the package",
        default: 5
      },
      nProcesses: {
        type: "number",
        requiresArg: true,
        description: "splits the measurment iterations across multiple child processes",
        default: os.cpus().length
      },
      maxRunSeconds,
      printSummary: {
        type: "boolean",
        description: "logs a benchmark summary before exiting",
        default: true
      },
      definitelyTypedPath,
      failOnErrors: {
        type: "boolean",
        description: "exits with a non-zero code if a measurement process crashes",
        default: true
      },
      installTypeScript: {
        type: "boolean",
        description: "installs TypeScript before running measurements",
        default: true
      },
      localTypeScriptPath
    },
    benchmark
  )
  .command(
    "getPackagesToBenchmark",
    "generates a benchmark manifest file to be run by multiple agents",
    {
      definitelyTypedPath: {
        ...definitelyTypedPath,
        coerce: (dtPath: string) => (path.isAbsolute(dtPath) ? dtPath : path.resolve(process.cwd(), dtPath))
      },
      agentCount: {
        type: "number",
        requiresArg: true,
        description: "the number of agents that will run the benchmarks",
        demandOption: true
      },
      tsVersion: {
        ...tsVersion,
        demandOption: true
      },
      outFile: {
        type: "string",
        requiresArg: true,
        description: "the path to the manifest file to be written",
        demandOption: true
      }
    },
    getPackagesToBenchmark
  )
  .command(
    "compare",
    "compare packages modified in a PR to those packages in the main branch",
    {
      definitelyTypedPath,
      tsVersion: {
        ...tsVersion,
        demandOption: true
      },
      maxRunSeconds,
      upload,
      comment: {
        type: "boolean",
        description: "leave a typescript-bot comment on the associated DefinitelyTyped PR"
      },
      runDependents: {
        description: "also compare packages dependent upon the modified packages",
        coerce: (r: any) => {
          if (typeof r !== "boolean" && typeof r !== "number") {
            throw new Error("'runDependents' must be a boolean or the maximum number of dependent packages to run");
          }
          if (r === true) return 2;
          if (r === false) return false;
          return r;
        }
      }
    },
    compare
  )
  .command(
    "compareTypeScript",
    "compare packages’ performance between different TypeScript versions",
    {
      file,
      compareAgainstVersion: {
        type: "string",
        requiresArg: true,
        description: "the TypeScript major/minor version to compare against",
        demandOption: true
      },
      packages: {
        type: ("array" as unknown) as undefined, // yargs seems to have a problem with "array" + `coerce`
        description: "list of packages to benchmark",
        requiresArg: true,
        coerce: (packages: string[]) => packages.map(parsePackageKey)
      },
      maxRunSeconds,
      definitelyTypedPath,
      localTypeScriptPath
    },
    compareTypeScriptCLI
  )
  .help().argv;

process.on("unhandledRejection", err => {
  console.error(err);
  process.exit(1);
});
