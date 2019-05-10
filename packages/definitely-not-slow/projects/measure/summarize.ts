import { PackageBenchmark, PackageBenchmarkSummary, StatSummary, LanguageServiceBenchmark } from '../common';
import { max, mean, median } from './utils';

export function summarize(benchmark: PackageBenchmark): PackageBenchmarkSummary {
  return {
    packageName: benchmark.packageName,
    packageVersion: benchmark.packageVersion,
    typeScriptVersion: benchmark.typeScriptVersion,
    sourceVersion: benchmark.sourceVersion,
    typeCount: benchmark.typeCount,
    relationCacheSizes: benchmark.relationCacheSizes,
    benchmarkDuration: benchmark.benchmarkDuration,
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
    return {
      ...acc,
      [key]: {
        mean: mean(durations),
        median: median(durations),
        worst,
      },
    };
  }, {} as Record<'completions' | 'quickInfo', StatSummary<LanguageServiceBenchmark>>);
}
