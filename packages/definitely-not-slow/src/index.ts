import * as os from 'os';
import * as path from 'path';
import { measurePerf } from './measurePerf';
import { getTypeScript } from './getTypeScript';
import { getCompletionStats } from './getCompletionStats';

if (!module.parent) {
  (async () => {
      const packageName = process.argv[2];
      console.log(`Measuring ${packageName}`);
      const measurement = measurePerf({
          packageName,
          iterations: 10,
          ts: await getTypeScript('next'),
          definitelyTypedRootPath: path.resolve(__dirname, '../../DefinitelyTyped'),
      });
      const completionStats = getCompletionStats(measurement.completions);
      const { worst } = completionStats;
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
      console.log('      Duration (ms):  ', completionStats.worst.duration.toPrecision(6));
      console.log('      Std. deviation: ', worst.standardDeviation.toPrecision(6));
      console.log('      Identifier:     ', completionStats.worst.identifierText);
      console.log('      Location:       ', `${worst.fileName}(${worst.line},${worst.offset})`);
  })();
}
