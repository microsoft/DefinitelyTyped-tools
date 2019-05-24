import * as os from 'os';
import { PackageBenchmarkSummary, getSystemInfo } from '../common';
import { mean, stdDev } from './utils';

function toPrecision(n: number, precision: number): string {
  return isNaN(n) ? 'N/A' : n.toPrecision(precision);
}

export function printSummary(summaries: PackageBenchmarkSummary[]) {
  for (const benchmark of summaries) {
    const { quickInfo, completions } = benchmark;
    const { worst: worstCompletion } = completions;
    const { worst: worstQuickInfo } = quickInfo;
    const versionString = `Version ${benchmark.packageVersion}`;
    console.log(os.EOL + versionString);
    console.log('-'.repeat(versionString.length));
    console.log('  Total duration (ms): ', benchmark.benchmarkDuration);
    console.log('  Type count:          ', benchmark.typeCount);
    if (benchmark.relationCacheSizes) {
      console.log('  Cache sizes');
      console.log('    Assignability: ', benchmark.relationCacheSizes.assignable);
      console.log('    Identity:      ', benchmark.relationCacheSizes.identity);
      console.log('    Subtype:       ', benchmark.relationCacheSizes.subtype);
    }
    console.log('  Completions');
    console.log('    Trials       ', `${completions.trials} (sampled from ${benchmark.testIdentifierCount * benchmark.requestedLanguageServiceTestIterations})`);
    console.log('    Mean (ms):   ', toPrecision(completions.mean, 6));
    console.log('    Median (ms): ', toPrecision(completions.median, 6));
    console.log('    Worst');
    console.log('      Duration (ms):  ', toPrecision(mean(worstCompletion.completionsDurations), 6));
    console.log('      Trials:         ', `${worstCompletion.completionsDurations.length} (wanted ${benchmark.requestedLanguageServiceTestIterations})`);
    console.log('      Std. deviation: ', toPrecision(stdDev(worstCompletion.completionsDurations), 6));
    console.log('      Identifier:     ', worstCompletion.identifierText);
    console.log('      Location:       ', `${worstCompletion.fileName}(${worstCompletion.line},${worstCompletion.offset})`);
    console.log('  Quick Info');
    console.log('    Trials       ', `${quickInfo.trials} (sampled from ${benchmark.testIdentifierCount * benchmark.requestedLanguageServiceTestIterations})`);
    console.log('    Mean (ms):   ', toPrecision(quickInfo.mean, 6));
    console.log('    Median (ms): ', toPrecision(quickInfo.median, 6));
    console.log('    Worst');
    console.log('      Duration (ms):  ', toPrecision(mean(worstQuickInfo.quickInfoDurations), 6));
    console.log('      Trials:         ', `${worstCompletion.completionsDurations.length} (wanted ${benchmark.requestedLanguageServiceTestIterations})`);
    console.log('      Std. deviation: ', toPrecision(stdDev(worstQuickInfo.quickInfoDurations), 6));
    console.log('      Identifier:     ', worstQuickInfo.identifierText);
    console.log('      Location:       ', `${worstQuickInfo.fileName}(${worstQuickInfo.line},${worstQuickInfo.offset})`);
  }
}
