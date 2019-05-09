import { LanguageServiceBenchmark } from '../common';
import { max, mean, median } from './utils';

interface LanguageServiceStats {
  mean: number;
  median: number;
  worst: LanguageServiceBenchmark;
}

export function getMeasurementStats(benchmarks: LanguageServiceBenchmark[]): Record<'completions' | 'quickInfo', LanguageServiceStats> {
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
  }, {} as Record<'completions' | 'quickInfo', LanguageServiceStats>);
}
