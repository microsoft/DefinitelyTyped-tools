import * as os from 'os';
import * as path from 'path';
import { getDatabase, DatabaseAccessLevel, config, getChangedPackages, packageIdsAreEqual, PackageBenchmark, PackageBenchmarkSummary, Args, getParsedPackages, assertString, withDefault } from '../common';
import { getLatestBenchmark } from '../query';
import { AllPackages } from 'types-publisher/bin/lib/packages';
import { benchmarkPackage } from './benchmark';
import { execAndThrowErrors } from 'types-publisher/bin/util/util';
import { getAffectedPackages } from 'types-publisher/bin/tester/get-affected-packages';
import { printSummary, summarize } from '../measure';

export interface CompareOptions {
  allPackages: AllPackages;
  definitelyTypedPath: string;
  typeScriptVersionMajorMinor: string;
  packageName: string;
  packageVersion: number;
}

export async function compare(args: Args) {
  const definitelyTypedPath = path.resolve(assertString(withDefault(args.definitelyTypedPath, process.cwd()), 'definitelyTypedPath'));
  const typeScriptVersionMajorMinor = assertString(args.typeScriptVersion ? args.typeScriptVersion.toString() : undefined);
  const { allPackages } = await getParsedPackages(definitelyTypedPath);
  const changedPackages = await getChangedPackages({ diffTo: 'origin/master', definitelyTypedPath });
  if (!changedPackages) {
    return;
  }

  const affectedPackages = getAffectedPackages(allPackages, changedPackages);
  for (const affectedPackage of affectedPackages.changedPackages) {
    console.log(`Comparing ${affectedPackage.id.name}/v${affectedPackage.major} because it changed...\n\n`);
    await compareBenchmarks({
      allPackages,
      definitelyTypedPath,
      typeScriptVersionMajorMinor,
      packageName: affectedPackage.id.name,
      packageVersion: affectedPackage.major,
    });
  }
  for (const affectedPackage of affectedPackages.dependentPackages) {
    console.log(`Comparing ${affectedPackage.id.name}/v${affectedPackage.major} because it depends on something that changed...\n\n`);
    await compareBenchmarks({
      allPackages,
      definitelyTypedPath,
      typeScriptVersionMajorMinor,
      packageName: affectedPackage.id.name,
      packageVersion: affectedPackage.major,
    });
  }
}

export async function compareBenchmarks({
  allPackages,
  definitelyTypedPath,
  typeScriptVersionMajorMinor,
  packageName,
  packageVersion,
}: CompareOptions) {
  const { container } = await getDatabase(DatabaseAccessLevel.Read);
  const latestBenchmarkDocument = await getLatestBenchmark({
    container,
    typeScriptVersionMajorMinor,
    packageName,
    packageVersion,
  });

  let latestBenchmark: PackageBenchmark | PackageBenchmarkSummary | undefined = latestBenchmarkDocument && latestBenchmarkDocument.body;
  const packageId = { name: packageName, majorVersion: packageVersion };
  const changedPackagesInPR = await getChangedPackages({ diffTo: 'origin/master', definitelyTypedPath });
  if (!changedPackagesInPR) {
    return; // Nothing to do?
  }

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
      const head = await execAndThrowErrors('git rev-parse HEAD');
      console.log(`No previous benchmark for ${packageName}/${packageVersion}. Checking out master and running one...`);
      await execAndThrowErrors('git checkout origin/master', definitelyTypedPath);
      latestBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
        definitelyTypedPath,
        printSummary: false,
        iterations: config.benchmarks.languageServiceIterations,
        progress: false,
        upload: true,
        tsVersion: typeScriptVersionMajorMinor,
        nProcesses: os.cpus().length,
        failOnErrors: true,
      }))[0];
      await execAndThrowErrors(`git checkout ${head}`);
    }
  }

  const currentBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
    definitelyTypedPath,
    printSummary: false,
    iterations: config.benchmarks.languageServiceIterations,
    progress: false,
    upload: false,
    tsVersion: typeScriptVersionMajorMinor,
    nProcesses: os.cpus().length,
    failOnErrors: true,
  }))[0];

  if (!latestBenchmark) {
    throw new Error('Failed to get a benchmark for master. This error should be impossible.');
  }

  console.log('master');
  console.log('======\n');
  console.log(printSummary('quickInfo' in latestBenchmark ? [latestBenchmark] : [summarize(latestBenchmark)]));
  console.log('\n');
  console.log('HEAD');
  console.log('====\n');
  console.log(printSummary([summarize(currentBenchmark)]));
}
