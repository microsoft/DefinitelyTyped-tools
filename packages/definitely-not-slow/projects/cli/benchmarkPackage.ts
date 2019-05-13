import * as os from 'os';
import * as path from 'path';
import { getDatabase, DatabaseAccessLevel, config, getParsedPackages, assertString, assertBoolean, withDefault, assertNumber } from '../common';
import { getTypeScript } from '../measure/getTypeScript';
import { insertPackageBenchmark } from '../write';
import { summarize, printSummary, measurePerf } from '../measure';
import { Args } from '../common';
import { PackageId } from 'types-publisher/bin/lib/packages';

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
    return {
      groups: fileContents.groups,
      ...convertArgs({ ...fileContents.options, ...args }),
    };
  }

  return {
    package: args.package ? assertString(args.package) : undefined,
    agentIndex: typeof args.agentIndex !== 'undefined' ? assertNumber(args.agentIndex) : undefined,
    upload: assertBoolean(withDefault(args.upload, true), 'upload'),
    tsVersion: assertString(withDefault(args.tsVersion, 'next')),
    progress: assertBoolean(withDefault(args.progress, true), 'progress'),
    iterations: assertNumber(withDefault(args.iterations, 5), 'iterations'),
    nProcesses: assertNumber(withDefault(args.nProcesses, os.cpus().length - 1), 'nProcesses'),
    maxLanguageServiceTestPositions: args.maxLanguageServiceTestPositions ? assertNumber(args.maxLanguageServiceTestPositions) : undefined,
    printSummary: assertBoolean(withDefault(args.printSummary, true), 'printSummary'),
    definitelyTypedPath: assertString(withDefault(args.definitelyTypedPath, path.resolve(__dirname, '../../../../DefinitelyTyped')), 'definitelyTypedPath'),
  };
}

export async function benchmark(args: Args) {
  const options = convertArgs(args);
  if (options.groups) {
    const group = options.groups[assertNumber(options.agentIndex, 'agentIndex')];
    for (const packageId of group) {
      await benchmarkPackage(packageId.name, packageId.majorVersion.toString(), options);
    }
  } else {
    const [packageName, packageVersion] = assertString(options.package, 'package').split('/');
    await benchmarkPackage(packageName, packageVersion, options);
  }
}

async function benchmarkPackage(packageName: string, packageVersion: string, options: BenchmarkPackageOptions) {
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
