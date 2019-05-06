import * as os from 'os';
import * as path from 'path';
import { measurePerf } from './measurePerf';
import { getTypeScript } from './getTypeScript';
import { getMeasurementStats } from './getMeasurementStats';

if (!module.parent) {
  (async () => {
      const packageName = process.argv[2];
      console.log(`Measuring ${packageName}`);
      const measurement = measurePerf({
          packageName,
          iterations: 1,
          ts: await getTypeScript('next'),
          definitelyTypedRootPath: path.resolve(__dirname, '../../DefinitelyTyped'),
      });
      const completionStats = getMeasurementStats(measurement.completions);
      const quickInfoStats = getMeasurementStats(measurement.quickInfo);
      const { worst: worstCompletion } = completionStats;
      const { worst: worstQuickInfo } = quickInfoStats;
      console.log(os.EOL);
      console.log('  Type count: ', measurement.typeCount);
      console.log('  Cache sizes');
      console.log('    Assignability: ', measurement.relationCacheSizes.assignable);
      console.log('    Identity:      ', measurement.relationCacheSizes.identity);
      console.log('    Subtype:       ', measurement.relationCacheSizes.subtype);
      console.log('  Completions');
      console.log('    Mean (ms):   ', completionStats.mean.toPrecision(6));
      console.log('    Median (ms): ', completionStats.median.toPrecision(6));
      console.log('    Worst');
      console.log('      Duration (ms):  ', worstCompletion.duration.toPrecision(6));
      console.log('      Std. deviation: ', worstCompletion.standardDeviation.toPrecision(6));
      console.log('      Identifier:     ', worstCompletion.identifierText);
      console.log('      Location:       ', `${worstCompletion.fileName}(${worstCompletion.line},${worstCompletion.offset})`);
      console.log('  Quick Info');
      console.log('    Mean (ms):   ', quickInfoStats.mean.toPrecision(6));
      console.log('    Median (ms): ', quickInfoStats.median.toPrecision(6));
      console.log('    Worst');
      console.log('      Duration (ms):  ', worstQuickInfo.duration.toPrecision(6));
      console.log('      Std. deviation: ', worstQuickInfo.standardDeviation.toPrecision(6));
      console.log('      Identifier:     ', worstQuickInfo.identifierText);
      console.log('      Location:       ', `${worstQuickInfo.fileName}(${worstQuickInfo.line},${worstQuickInfo.offset})`);
  })();
}
