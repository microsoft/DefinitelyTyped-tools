import * as os from 'os';
import * as path from 'path';
import { getLocallyInstalledDefinitelyTyped } from 'types-publisher/bin/get-definitely-typed';
import parseDefinitions from 'types-publisher/bin/parse-definitions';
import { AllPackages, typesDataFilename } from 'types-publisher/bin/lib/packages';
import { measurePerf } from './measurePerf';
import { getTypeScript } from './getTypeScript';
import { getMeasurementStats } from './getMeasurementStats';
import { consoleLogger } from 'types-publisher/bin/util/logging';
import { pathExists, deserializeArgs } from '../common';
import { dataFilePath } from 'types-publisher/bin/lib/common';
import { mean, stdDev } from './utils';

if (!module.parent) {
  (async () => {
    const [packageName, packageVersion] = process.argv[2].split('/');
    const args = deserializeArgs(process.argv.slice(3));
    const definitelyTypedRootPath = path.resolve(__dirname, '../../../../DefinitelyTyped');
    const definitelyTypedFS = getLocallyInstalledDefinitelyTyped(definitelyTypedRootPath);
    const isDebugging = process.execArgv.some(arg => arg.startsWith('--inspect'));
    if (process.env.NODE_ENV === 'production' || !(await pathExists(dataFilePath(typesDataFilename)))) {
      await parseDefinitions(definitelyTypedFS, isDebugging ? undefined : {
        definitelyTypedPath: definitelyTypedRootPath,
        nProcesses: os.cpus().length,
      }, consoleLogger);
    }
    const { ts, tsPath } = await getTypeScript('next');
    const allPackages = await AllPackages.read(definitelyTypedFS);
    console.log(`Measuring ${packageName}`);
    const measurements = await measurePerf({
      typeScriptVersion: ts.version,
      packageName,
      packageVersion: packageVersion ? packageVersion.replace(/^v/, '') : undefined,
      iterations: 1,
      allPackages,
      definitelyTypedRootPath,
      definitelyTypedFS,
      ts,
      tsPath,
      ...args,
    });

    for (const measurement of measurements) {
      const completionStats = getMeasurementStats(measurement.completions);
      const quickInfoStats = getMeasurementStats(measurement.quickInfo);
      const { worst: worstCompletion } = completionStats;
      const { worst: worstQuickInfo } = quickInfoStats;
      const versionString = `Version ${measurement.packageVersion}`;
      console.log(os.EOL);
      console.log(versionString);
      console.log('='.repeat(versionString.length));
      console.log('  Type count: ', measurement.typeCount);
      console.log('  Cache sizes');
      console.log('    Assignability: ', measurement.relationCacheSizes.assignable);
      console.log('    Identity:      ', measurement.relationCacheSizes.identity);
      console.log('    Subtype:       ', measurement.relationCacheSizes.subtype);
      console.log('  Completions');
      console.log('    Mean (ms):   ', completionStats.mean.toPrecision(6));
      console.log('    Median (ms): ', completionStats.median.toPrecision(6));
      console.log('    Worst');
      console.log('      Duration (ms):  ', mean(worstCompletion.durations).toPrecision(6));
      console.log('      Std. deviation: ', stdDev(worstCompletion.durations).toPrecision(6));
      console.log('      Identifier:     ', worstCompletion.identifierText);
      console.log('      Location:       ', `${worstCompletion.fileName}(${worstCompletion.line},${worstCompletion.offset})`);
      console.log('  Quick Info');
      console.log('    Mean (ms):   ', quickInfoStats.mean.toPrecision(6));
      console.log('    Median (ms): ', quickInfoStats.median.toPrecision(6));
      console.log('    Worst');
      console.log('      Duration (ms):  ', mean(worstQuickInfo.durations).toPrecision(6));
      console.log('      Std. deviation: ', stdDev(worstQuickInfo.durations).toPrecision(6));
      console.log('      Identifier:     ', worstQuickInfo.identifierText);
      console.log('      Location:       ', `${worstQuickInfo.fileName}(${worstQuickInfo.line},${worstQuickInfo.offset})`);
    }
  })();
}
