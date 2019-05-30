import * as os from 'os';
import * as path from 'path';
import { getDatabase, DatabaseAccessLevel, config, getChangedPackages, packageIdsAreEqual, PackageBenchmark, PackageBenchmarkSummary, Args, getParsedPackages, assertString, withDefault, Document, createDocument, assertNumber } from '../common';
import { getLatestBenchmark } from '../query';
import { AllPackages } from 'types-publisher/bin/lib/packages';
import { benchmarkPackage } from './benchmark';
import { execAndThrowErrors } from 'types-publisher/bin/util/util';
import { getAffectedPackages } from 'types-publisher/bin/tester/get-affected-packages';
import { printSummary, summarize } from '../measure';
import { getTypeScript } from '../measure/getTypeScript';
import { postInitialComparisonResults } from '../github/postInitialComparisonResults';
import { postDependentsComparisonResult } from '../github/postDependentsComparisonResults';

export interface CompareOptions {
  allPackages: AllPackages;
  definitelyTypedPath: string;
  typeScriptVersionMajorMinor: string;
  packageName: string;
  packageVersion: number;
  maxRunSeconds?: number;
}

export async function compare(args: Args) {
  const definitelyTypedPath = path.resolve(assertString(withDefault(args.definitelyTypedPath, process.cwd()), 'definitelyTypedPath'));
  const typeScriptVersionMajorMinor = assertString(args.typeScriptVersion ? args.typeScriptVersion.toString() : undefined);
  const { allPackages } = await getParsedPackages(definitelyTypedPath);
  const changedPackages = await getChangedPackages({ diffTo: 'origin/master', definitelyTypedPath });
  const maxRunSeconds = args.maxRunSeconds ? assertNumber(args.maxRunSeconds) : undefined;
  const shouldComment = !!args.comment;
  if (!changedPackages) {
    return;
  }

  await getTypeScript(typeScriptVersionMajorMinor);
  const affectedPackages = getAffectedPackages(allPackages, changedPackages);
  const comparisons: [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>][] = [];
  for (const affectedPackage of affectedPackages.changedPackages) {
    console.log(`Comparing ${affectedPackage.id.name}/v${affectedPackage.major} because it changed...\n\n`);
    comparisons.push(await compareBenchmarks({
      allPackages,
      definitelyTypedPath,
      typeScriptVersionMajorMinor,
      packageName: affectedPackage.id.name,
      packageVersion: affectedPackage.major,
      maxRunSeconds,
    }));
  }

  if (comparisons.length) {
    const message = await postInitialComparisonResults({
      comparisons,
      dependentCount: affectedPackages.dependentPackages.length,
      dryRun: !shouldComment,
    });
    console.log('\n' + message + '\n');
  }

  const dependentComparisons: [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>][] = [];
  for (const affectedPackage of affectedPackages.dependentPackages) {
    console.log(`Comparing ${affectedPackage.id.name}/v${affectedPackage.major} because it depends on something that changed...\n\n`);
    dependentComparisons.push(await compareBenchmarks({
      allPackages,
      definitelyTypedPath,
      typeScriptVersionMajorMinor,
      packageName: affectedPackage.id.name,
      packageVersion: affectedPackage.major,
      maxRunSeconds,
    }));
  }

  if (dependentComparisons.length) {
    const message = await postDependentsComparisonResult({ comparisons: dependentComparisons, dryRun: !shouldComment });
    console.log('\n' + message + '\n');
  }
}

export async function compareBenchmarks({
  allPackages,
  definitelyTypedPath,
  typeScriptVersionMajorMinor,
  packageName,
  packageVersion,
  maxRunSeconds,
}: CompareOptions): Promise<[Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>]> {
  const { packageBenchmarks: container } = await getDatabase(DatabaseAccessLevel.Read);
  const latestBenchmarkDocument = await getLatestBenchmark({
    container,
    typeScriptVersionMajorMinor,
    packageName,
    packageVersion,
  });

  let latestBenchmark: PackageBenchmarkSummary | undefined = latestBenchmarkDocument && latestBenchmarkDocument.body;
  const packageId = { name: packageName, majorVersion: packageVersion };

  const changedPackagesBetweenLastRunAndMaster = latestBenchmark && await getChangedPackages({
    diffFrom: 'origin/master',
    diffTo: latestBenchmark.sourceVersion,
    definitelyTypedPath,
  });

  if (changedPackagesBetweenLastRunAndMaster || !latestBenchmark) {
    let needsRerun = !latestBenchmark;
    if (changedPackagesBetweenLastRunAndMaster) {
      const affectedPackages = getAffectedPackages(allPackages, changedPackagesBetweenLastRunAndMaster);
      const affected = [...affectedPackages.changedPackages, ...affectedPackages.dependentPackages];
      needsRerun = affected.some(affectedPackage => packageIdsAreEqual(packageId, affectedPackage.id));
    }
    if (needsRerun) {
      console.log(`No previous benchmark for ${packageName}/v${packageVersion}. Checking out master and running one...`);
      await execAndThrowErrors('git checkout origin/master', definitelyTypedPath);
      const latest = await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
        definitelyTypedPath,
        printSummary: true,
        iterations: config.benchmarks.languageServiceIterations,
        progress: false,
        upload: true,
        tsVersion: typeScriptVersionMajorMinor,
        nProcesses: os.cpus().length,
        failOnErrors: true,
        installTypeScript: false,
        maxRunSeconds,
      });
      await execAndThrowErrors(`git checkout -`);
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
    maxRunSeconds,
  }))!.summary;

  if (latestBenchmark) {
    console.log('\nmaster');
    console.log('======');
    console.log(printSummary([latestBenchmark]));
  }

  console.log('\nHEAD');
  console.log('====');
  console.log(printSummary([currentBenchmark]));
  return [
    latestBenchmarkDocument || latestBenchmark && createDocument(latestBenchmark, config.database.packageBenchmarksDocumentSchemaVersion),
    createDocument(currentBenchmark, config.database.packageBenchmarksDocumentSchemaVersion),
  ];
}
