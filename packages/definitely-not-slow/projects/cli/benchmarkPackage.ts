import * as os from 'os';
import * as path from 'path';
import { pathExists, getDatabase, DatabaseAccessLevel } from '../common';
import { getLocallyInstalledDefinitelyTyped } from 'types-publisher/bin/get-definitely-typed';
import { dataFilePath } from 'types-publisher/bin/lib/common';
import { typesDataFilename, AllPackages } from 'types-publisher/bin/lib/packages';
import parseDefinitions from 'types-publisher/bin/parse-definitions';
import { consoleLogger } from 'types-publisher/bin/util/logging';
import { getTypeScript } from '../measure/getTypeScript';
import { insertBenchmark } from '../write';
import { printSummary, measurePerf } from '../measure';
import { Args } from "../common";
import { cliArgumentError } from './utils';

export async function benchmarkPackage(args: Args) {
  const {
    package: packageStr,
    upload,
    tsVersion = 'next',
    progress = true,
    iterations = 5,
    printSummary: shouldPrintSummary = true,
    definitelyTypedPath = path.resolve(__dirname, '../../../../DefinitelyTyped'),
    ...extraArgs
  } = args;

  if (typeof packageStr !== 'string') {
    return cliArgumentError('package', 'string', packageStr, true);
  }
  if (typeof definitelyTypedPath !== 'string') {
    return cliArgumentError('definitelyTypedPath', 'string', definitelyTypedPath);
  }
  if (typeof iterations !== 'number') {
    return cliArgumentError('iterations', 'number', iterations);
  }

  const [packageName, packageVersion] = packageStr.split('/');
  const definitelyTypedFS = getLocallyInstalledDefinitelyTyped(definitelyTypedPath);
  const isDebugging = process.execArgv.some(arg => arg.startsWith('--inspect'));
  if (process.env.NODE_ENV === 'production' || !(await pathExists(dataFilePath(typesDataFilename)))) {
    await parseDefinitions(definitelyTypedFS, isDebugging ? undefined : {
      definitelyTypedPath,
      nProcesses: os.cpus().length,
    }, consoleLogger);
  }
  const { ts, tsPath } = await getTypeScript('next');
  const allPackages = await AllPackages.read(definitelyTypedFS);
  const benchmarks = await measurePerf({
    ...extraArgs,
    packageName,
    packageVersion,
    allPackages,
    iterations,
    definitelyTypedFS,
    definitelyTypedRootPath: definitelyTypedPath,
    typeScriptVersion: ts.version,
    tsPath,
    ts,
  });

  if (shouldPrintSummary) {
    printSummary(benchmarks);
  }

  if (upload) {
    const { container } = await getDatabase(DatabaseAccessLevel.Write);
    await Promise.all(benchmarks.map(benchmark => insertBenchmark(benchmark, container)));
  }
}
