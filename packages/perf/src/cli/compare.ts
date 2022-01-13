import * as os from "os";
import {
  config,
  getChangedPackages,
  PackageBenchmarkSummary,
  getParsedPackages,
  shuffle,
  forEachWithTimeLimit
} from "../common";
import { benchmarkPackage } from "./benchmark";
import { printSummary } from "../measure";
import { getTypeScript } from "../measure/getTypeScript";
import { postInitialComparisonResults } from "../github/postInitialComparisonResults";
import { postDependentsComparisonResult } from "../github/postDependentsComparisonResults";
import { AllPackages, DependencyVersion, getAffectedPackages } from "@definitelytyped/definitions-parser";
import { execAndThrowErrors } from "@definitelytyped/utils";

export interface CompareOptions {
  allPackages: AllPackages;
  definitelyTypedPath: string;
  typeScriptVersionMajorMinor: string;
  packageName: string;
  packageVersion: DependencyVersion;
  maxRunSeconds?: number;
  upload?: boolean;
}

export interface CompareArgs {
  definitelyTypedPath: string;
  tsVersion: string;
  maxRunSeconds?: number;
  upload?: boolean;
  comment?: boolean;
  runDependents?: number | false;
}

export async function compare({
  definitelyTypedPath,
  tsVersion,
  maxRunSeconds,
  runDependents,
  comment,
  upload
}: CompareArgs) {
  const { allPackages } = await getParsedPackages(definitelyTypedPath);
  const changedPackages = await getChangedPackages({ diffTo: "origin/master", definitelyTypedPath });

  if (!changedPackages) {
    console.log("No changed packages; nothing to do");
    return;
  }

  await getTypeScript(tsVersion);
  const affectedPackages = getAffectedPackages(allPackages, changedPackages);
  const comparisons: [PackageBenchmarkSummary, PackageBenchmarkSummary][] = [];
  const maxRunMs = (maxRunSeconds ?? Infinity) * 1000;
  const { overtime } = await forEachWithTimeLimit(
    maxRunMs,
    affectedPackages.changedPackages,
    async affectedPackage => {
      console.log(`Comparing ${affectedPackage.id.name}/v${affectedPackage.major} because it changed...\n\n`);
      comparisons.push(
        await compareBenchmarks({
          allPackages,
          definitelyTypedPath,
          typeScriptVersionMajorMinor: tsVersion,
          packageName: affectedPackage.id.name,
          packageVersion: affectedPackage.id.version,
          maxRunSeconds,
          upload
        })
      );
    },
    affectedPackage => {
      console.log(`Skipping ${affectedPackage.id.name} because we ran out of time`);
    }
  );

  const dependentsToTest =
    runDependents && !overtime ? shuffle(affectedPackages.dependentPackages).slice(0, runDependents) : [];
  if (comparisons.length) {
    const message = await postInitialComparisonResults({
      comparisons,
      dependentCount: dependentsToTest.length,
      dryRun: !comment
    });
    if (message) {
      console.log("\n" + message + "\n");
    }
  }

  const dependentComparisons: [PackageBenchmarkSummary, PackageBenchmarkSummary][] = [];
  await forEachWithTimeLimit(
    maxRunMs,
    dependentsToTest,
    async affectedPackage => {
      console.log(
        `Comparing ${affectedPackage.id.name}/v${affectedPackage.major} because it depends on something that changed...\n\n`
      );
      dependentComparisons.push(
        await compareBenchmarks({
          allPackages,
          definitelyTypedPath,
          typeScriptVersionMajorMinor: tsVersion,
          packageName: affectedPackage.id.name,
          packageVersion: affectedPackage.id.version,
          maxRunSeconds,
          upload
        })
      );
    },
    affectedPackage => {
      console.log(`Skipping ${affectedPackage.id.name} because we ran out of time`);
    }
  );

  if (dependentComparisons.length) {
    const message = await postDependentsComparisonResult({ comparisons: dependentComparisons, dryRun: !comment });
    console.log("\n" + message + "\n");
  }
}

export async function compareBenchmarks({
  allPackages,
  definitelyTypedPath,
  typeScriptVersionMajorMinor,
  packageName,
  packageVersion,
  maxRunSeconds
}: CompareOptions): Promise<[PackageBenchmarkSummary, PackageBenchmarkSummary]> {
  await execAndThrowErrors("git checkout -f origin/master && git clean -xdf types", definitelyTypedPath);
  const baseBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
    allPackages,
    definitelyTypedPath,
    printSummary: false,
    iterations: config.benchmarks.languageServiceIterations,
    progress: false,
    tsVersion: typeScriptVersionMajorMinor,
    nProcesses: os.cpus().length,
    failOnErrors: true,
    installTypeScript: false,
    maxRunSeconds
  }))?.summary;

  if (!baseBenchmark) {
    throw new Error(`Package ${packageName} does not exist in master so cannot be compared.`);
  }

  await execAndThrowErrors(`git checkout -f . && git checkout - && git clean -xdf types`, definitelyTypedPath);
  const headBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
    allPackages,
    definitelyTypedPath,
    printSummary: true,
    iterations: config.benchmarks.languageServiceIterations,
    progress: false,
    tsVersion: typeScriptVersionMajorMinor,
    nProcesses: os.cpus().length,
    failOnErrors: true,
    installTypeScript: false,
    maxRunSeconds
  }))!.summary;

  if (baseBenchmark) {
    console.log("\nmaster");
    console.log("======");
    console.log(printSummary([baseBenchmark]));
  }

  console.log("\nHEAD");
  console.log("====");
  console.log(printSummary([headBenchmark]));
  return [baseBenchmark, headBenchmark];
}
