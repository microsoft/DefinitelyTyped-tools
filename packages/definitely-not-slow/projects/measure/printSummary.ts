import * as os from 'os';
import { PackageBenchmark } from '../common';
import { getMeasurementStats } from './getMeasurementStats';
import { mean, stdDev } from './utils';

export function printSummary(benchmarks: PackageBenchmark[]) {
  for (const benchmark of benchmarks) {
    const { quickInfo, completions } = getMeasurementStats(benchmark.languageServiceBenchmarks);
    const { worst: worstCompletion } = completions;
    const { worst: worstQuickInfo } = quickInfo;
    const versionString = `Version ${benchmark.packageVersion}`;
    console.log(os.EOL);
    console.log(versionString);
    console.log('='.repeat(versionString.length));
    console.log('  Type count: ', benchmark.typeCount);
    console.log('  Cache sizes');
    console.log('    Assignability: ', benchmark.relationCacheSizes.assignable);
    console.log('    Identity:      ', benchmark.relationCacheSizes.identity);
    console.log('    Subtype:       ', benchmark.relationCacheSizes.subtype);
    console.log('  Completions');
    console.log('    Mean (ms):   ', completions.mean.toPrecision(6));
    console.log('    Median (ms): ', completions.median.toPrecision(6));
    console.log('    Worst');
    console.log('      Duration (ms):  ', mean(worstCompletion.completionsDurations).toPrecision(6));
    console.log('      Std. deviation: ', stdDev(worstCompletion.completionsDurations).toPrecision(6));
    console.log('      Identifier:     ', worstCompletion.identifierText);
    console.log('      Location:       ', `${worstCompletion.fileName}(${worstCompletion.line},${worstCompletion.offset})`);
    console.log('  Quick Info');
    console.log('    Mean (ms):   ', quickInfo.mean.toPrecision(6));
    console.log('    Median (ms): ', quickInfo.median.toPrecision(6));
    console.log('    Worst');
    console.log('      Duration (ms):  ', mean(worstQuickInfo.quickInfoDurations).toPrecision(6));
    console.log('      Std. deviation: ', stdDev(worstQuickInfo.quickInfoDurations).toPrecision(6));
    console.log('      Identifier:     ', worstQuickInfo.identifierText);
    console.log('      Location:       ', `${worstQuickInfo.fileName}(${worstQuickInfo.line},${worstQuickInfo.offset})`);
  }
}
