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
  for (const affectedPackage of [...affectedPackages.changedPackages, ...affectedPackages.dependentPackages]) {
    console.log(`Comparing ${affectedPackage.id.name}/v${affectedPackage.major}...\n\n`);
    await compareBenchmarks({
      allPackages,
      definitelyTypedPath,
      typeScriptVersionMajorMinor,
      packageName: affectedPackage.id.name,
      packageVersion: affectedPackage.major,
    })
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

  if (!latestBenchmarkDocument) {
    return //something
  }

  let latestBenchmark: PackageBenchmark | PackageBenchmarkSummary = latestBenchmarkDocument.body;
  const packageId = { name: packageName, majorVersion: packageVersion };
  const changedPackagesInPR = await getChangedPackages({ diffTo: 'origin/master', definitelyTypedPath });
  if (!changedPackagesInPR) {
    return; // Nothing to do?
  }

  const changedPackagesBetweenLastRunAndMaster = await getChangedPackages({
    diffFrom: 'origin/master',
    diffTo: latestBenchmarkDocument.body.sourceVersion,
    definitelyTypedPath,
  });

  if (changedPackagesBetweenLastRunAndMaster) {
    const affectedPackages = getAffectedPackages(allPackages, changedPackagesBetweenLastRunAndMaster);
    const affected = [...affectedPackages.changedPackages, ...affectedPackages.dependentPackages];
    const needsRerun = affected.some(affectedPackage => packageIdsAreEqual(packageId, affectedPackage.id));
    if (needsRerun) {
      const head = await execAndThrowErrors('git rev-parse HEAD');
      await execAndThrowErrors('git checkout origin/master', definitelyTypedPath);
      latestBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
        definitelyTypedPath,
        printSummary: false,
        iterations: config.benchmarks.languageServiceIterations,
        progress: true,
        upload: true,
        tsVersion: typeScriptVersionMajorMinor,
        nProcesses: os.cpus().length,
      }))[0];
      await execAndThrowErrors(`git checkout ${head}`);
    }
  }

  const currentBenchmark = (await benchmarkPackage(packageName, packageVersion.toString(), new Date(), {
    definitelyTypedPath,
    printSummary: false,
    iterations: config.benchmarks.languageServiceIterations,
    progress: true,
    upload: false,
    tsVersion: typeScriptVersionMajorMinor,
    nProcesses: os.cpus().length,
  }))[0];

  console.log('master');
  console.log('======\n');
  console.log(printSummary('quickInfo' in latestBenchmark ? [latestBenchmark] : [summarize(latestBenchmark)]));
  console.log('\n');
  console.log('HEAD');
  console.log('====\n');
  console.log(printSummary([summarize(currentBenchmark)]));
}
