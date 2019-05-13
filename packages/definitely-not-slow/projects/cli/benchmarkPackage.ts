import * as os from 'os';
import * as path from 'path';
import { getDatabase, DatabaseAccessLevel, config, getParsedPackages } from '../common';
import { getTypeScript } from '../measure/getTypeScript';
import { insertPackageBenchmark } from '../write';
import { summarize, printSummary, measurePerf } from '../measure';
import { Args } from '../common';
import { cliArgumentError } from './utils';

export async function benchmarkPackage(args: Args) {
  const {
    package: packageStr,
    upload,
    tsVersion = 'next',
    progress = true,
    iterations = 5,
    nProcesses = os.cpus().length - 1,
    maxLanguageServiceTestPositions,
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
  if (typeof maxLanguageServiceTestPositions !== 'number' && typeof maxLanguageServiceTestPositions !== 'undefined') {
    return cliArgumentError('maxLanguageServiceTestPositions', 'number', maxLanguageServiceTestPositions);
  }
  if (typeof nProcesses !== 'number') {
    return cliArgumentError('nProcesses', 'number', nProcesses);
  }
  if (typeof progress !== 'boolean') {
    return cliArgumentError('progress', 'boolean', progress);
  }

  const [packageName, packageVersion] = packageStr.split('/');
  const { ts, tsPath } = await getTypeScript(tsVersion.toString());
  const { allPackages, definitelyTypedFS } = await getParsedPackages(definitelyTypedPath);
  const benchmarks = await measurePerf({
    ...extraArgs,
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
