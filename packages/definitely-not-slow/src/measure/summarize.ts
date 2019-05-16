import { PackageBenchmark, PackageBenchmarkSummary, StatSummary, LanguageServiceBenchmark } from '../common';
import { max, mean, median, stdDev } from './utils';

export function summarize(benchmark: PackageBenchmark): PackageBenchmarkSummary {
  return {
    packageName: benchmark.packageName,
    packageVersion: benchmark.packageVersion,
    typeScriptVersion: benchmark.typeScriptVersion,
    typeScriptVersionMajorMinor: benchmark.typeScriptVersionMajorMinor,
    sourceVersion: benchmark.sourceVersion,
    typeCount: benchmark.typeCount,
    relationCacheSizes: benchmark.relationCacheSizes,
    benchmarkDuration: benchmark.benchmarkDuration,
    batchRunStart: benchmark.batchRunStart,
    testIdentifierCount: benchmark.testIdentifierCount,
    requestedLanguageServiceTestIterations: benchmark.requestedLanguageServiceTestIterations,
    ...summarizeStats(benchmark.languageServiceBenchmarks),
  }
}

export function summarizeStats(benchmarks: LanguageServiceBenchmark[]): {
  quickInfo: StatSummary<LanguageServiceBenchmark>;
  completions: StatSummary<LanguageServiceBenchmark>;
 } {
  return [
    ['completions', (benchmark: LanguageServiceBenchmark) => benchmark.completionsDurations] as const,
    ['quickInfo', (benchmark: LanguageServiceBenchmark) => benchmark.quickInfoDurations] as const,
  ].reduce((acc, [key, getDurations]) => {
    const durations = Array.prototype.concat.apply([], benchmarks.map(getDurations));
    const worst = max(benchmarks, m => mean(getDurations(m)));
    const stats: StatSummary<LanguageServiceBenchmark> = {
      mean: mean(durations),
      median: median(durations),
      standardDeviation: stdDev(durations),
      trials: durations.length,
      worst,
    };

    return {
      ...acc,
      [key]: stats,
    };
  }, {} as Record<'completions' | 'quickInfo', StatSummary<LanguageServiceBenchmark>>);
}
