import * as os from "os";
import {
  getDatabase,
  DatabaseAccessLevel,
  config,
  getChangedPackages,
  packageIdsAreEqual,
  PackageBenchmarkSummary,
  getParsedPackages,
  Document,
  createDocument,
  shuffle,
  systemsAreCloseEnough,
  getSystemInfo,
  forEachWithTimeLimit
} from "../common";
import { getLatestBenchmark } from "../query";
import { benchmarkPackage } from "./benchmark";
import { printSummary } from "../measure";
import { getTypeScript } from "../measure/getTypeScript";
import { postInitialComparisonResults } from "../github/postInitialComparisonResults";
import { postDependentsComparisonResult } from "../github/postDependentsComparisonResults";
import { AllPackages, DependencyVersion, getAffectedPackages, PackageId } from "@definitelytyped/definitions-parser";
import { execAndThrowErrors } from "@definitelytyped/utils";
const currentSystem = getSystemInfo();

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
  const comparisons: [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>][] = [];
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

  const dependentComparisons: [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>][] = [];
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
  maxRunSeconds,
  upload = true
}: CompareOptions): Promise<[Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>]> {
  const { packageBenchmarks: container } = await getDatabase(DatabaseAccessLevel.Read);
  const latestBenchmarkDocument = await getLatestBenchmark({
    container,
    typeScriptVersionMajorMinor,
    packageName,
    packageVersion
  });

  let latestBenchmark: PackageBenchmarkSummary | undefined = latestBenchmarkDocument && latestBenchmarkDocument.body;
  const packageId: PackageId = {
    name: packageName,
    version: packageVersion
  };

  const changedPackagesBetweenLastRunAndMaster =
    latestBenchmark &&
    (await getChangedPackages({
      diffFrom: "origin/master",
      diffTo: latestBenchmark.sourceVersion,
      definitelyTypedPath
    }));

  if (latestBenchmarkDocument && !systemsAreCloseEnough(currentSystem, latestBenchmarkDocument.system)) {
    latestBenchmark = undefined;
  }

  if (changedPackagesBetweenLastRunAndMaster || !latestBenchmark) {
    let needsRerun = !latestBenchmark;
    if (changedPackagesBetweenLastRunAndMaster) {
      const affectedPackages = getAffectedPackages(allPackages, changedPackagesBetweenLastRunAndMaster);
      const affected = [...affectedPackages.changedPackages, ...affectedPackages.dependentPackages];
      needsRerun = affected.some(affectedPackage => packageIdsAreEqual(packageId, affectedPackage.id));
    }
    if (needsRerun) {
      console.log(
        `No comparable benchmark for ${packageName}/v${packageVersion}. Checking out master and running one...`
      );
      await execAndThrowErrors("git checkout origin/master && git clean -xdf types", definitelyTypedPath);
      const latest = await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
        definitelyTypedPath,
        printSummary: false,
        iterations: config.benchmarks.languageServiceIterations,
        progress: false,
        upload,
        tsVersion: typeScriptVersionMajorMinor,
        nProcesses: os.cpus().length,
        failOnErrors: true,
        installTypeScript: false,
        maxRunSeconds
      });
      await execAndThrowErrors(`git checkout . && git checkout - && git clean -xdf types`, definitelyTypedPath);
      latestBenchmark = latest && latest.summary;
    }
  }

  const currentBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
    definitelyTypedPath,
    printSummary: true,
    iterations: config.benchmarks.languageServiceIterations,
    progress: false,
    upload: false,
    tsVersion: typeScriptVersionMajorMinor,
    nProcesses: os.cpus().length,
    failOnErrors: true,
    installTypeScript: false,
    maxRunSeconds
  }))!.summary;

  if (latestBenchmark) {
    console.log("\nmaster");
    console.log("======");
    console.log(printSummary([latestBenchmark]));
  }

  console.log("\nHEAD");
  console.log("====");
  console.log(printSummary([currentBenchmark]));
  return [
    latestBenchmarkDocument ||
      (latestBenchmark && createDocument(latestBenchmark, config.database.packageBenchmarksDocumentSchemaVersion)),
    createDocument(currentBenchmark, config.database.packageBenchmarksDocumentSchemaVersion)
  ];
}
