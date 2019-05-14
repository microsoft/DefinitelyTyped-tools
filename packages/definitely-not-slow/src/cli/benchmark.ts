import * as os from 'os';
import * as path from 'path';
import { getDatabase, DatabaseAccessLevel, config, getParsedPackages, assertString, assertBoolean, withDefault, assertNumber, getSystemInfo } from '../common';
import { getTypeScript } from '../measure/getTypeScript';
import { insertPackageBenchmark } from '../write';
import { summarize, printSummary, measurePerf } from '../measure';
import { Args } from '../common';
import { PackageId } from 'types-publisher/bin/lib/packages';
const currentSystem = getSystemInfo();

export interface BenchmarkPackageOptions {
  groups?: PackageId[][];
  agentIndex?: number;
  package?: string;
  upload: boolean;
  tsVersion: string;
  progress: boolean;
  iterations: number;
  nProcesses: number;
  maxLanguageServiceTestPositions?: number;
  printSummary: boolean;
  definitelyTypedPath: string;
}

function convertArgs({ file, ...args }: Args): BenchmarkPackageOptions {
  if (file) {
    const fileContents = require(path.resolve(assertString(file, 'file')));
    if (fileContents.system.hash !== currentSystem.hash) {
      console.warn('Systems mismatch; requested:');
      console.warn(JSON.stringify(fileContents.system, undefined, 2) + os.EOL);
      console.warn('Current:');
      console.warn(JSON.stringify(currentSystem, undefined, 2) + os.EOL);
    }
    return {
      groups: fileContents.groups,
      ...convertArgs({ ...fileContents.options, ...args }),
    };
  }

  return {
    package: args.package ? assertString(args.package) : undefined,
    agentIndex: typeof args.agentIndex !== 'undefined' ? assertNumber(args.agentIndex, 'agentIndex') : undefined,
    upload: assertBoolean(withDefault(args.upload, true), 'upload'),
    tsVersion: assertString(withDefault(args.tsVersion, 'next')),
    progress: assertBoolean(withDefault(args.progress, true), 'progress'),
    iterations: assertNumber(withDefault(args.iterations, 5), 'iterations'),
    nProcesses: assertNumber(withDefault(args.nProcesses, os.cpus().length - 1), 'nProcesses'),
    maxLanguageServiceTestPositions: args.maxLanguageServiceTestPositions ? assertNumber(args.maxLanguageServiceTestPositions) : undefined,
    printSummary: assertBoolean(withDefault(args.printSummary, true), 'printSummary'),
    definitelyTypedPath: path.resolve(assertString(withDefault(args.definitelyTypedPath, process.cwd()), 'definitelyTypedPath')),
  };
}

export async function benchmark(args: Args) {
  const options = convertArgs(args);
  const time = new Date();
  if (options.groups) {
    const group = options.groups[assertNumber(options.agentIndex, 'agentIndex')];
    for (let i = 0; i < group.length; i++) {
      const packageId = group[i];
      const logString = `Benchmarking ${packageId.name}/${packageId.majorVersion} (${i + 1} of ${group.length})`;
      console.log(logString);
      console.log('='.repeat(logString.length) + os.EOL);
      await benchmarkPackage(packageId.name, packageId.majorVersion.toString(), time, options);
    }
  } else {
    const [packageName, packageVersion] = assertString(options.package, 'package').split('/');
    await benchmarkPackage(packageName, packageVersion, time, options);
  }
}

async function benchmarkPackage(packageName: string, packageVersion: string, batchRunStart: Date, options: BenchmarkPackageOptions) {
  const {
    upload,
    progress,
    iterations,
    nProcesses,
    tsVersion,
    maxLanguageServiceTestPositions,
    printSummary: shouldPrintSummary,
    definitelyTypedPath,
  } = options;
  const { ts, tsPath } = await getTypeScript(tsVersion.toString());
  const { allPackages, definitelyTypedFS } = await getParsedPackages(definitelyTypedPath);
  const benchmarks = await measurePerf({
    packageName,
    packageVersion: packageVersion ? packageVersion.replace(/^v/, '') : undefined,
    allPackages,
    iterations,
    progress,
    definitelyTypedFS,
    definitelyTypedRootPath: definitelyTypedPath,
    typeScriptVersion: ts.version,
    maxLanguageServiceTestPositions,
    nProcesses,
    tsPath,
    ts,
    batchRunStart,
  });

  const summaries = benchmarks.map(summarize);

  if (shouldPrintSummary) {
    printSummary(summaries);
  }

  if (upload) {
    const { container } = await getDatabase(DatabaseAccessLevel.Write);
    return Promise.all(summaries.map(summary => {
      return insertPackageBenchmark(
        summary,
        config.database.packageBenchmarksDocumentSchemaVersion,
        container);
    }));
  }
}
