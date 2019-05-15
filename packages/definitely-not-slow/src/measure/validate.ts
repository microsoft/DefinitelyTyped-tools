import { PackageBenchmark } from '../common';

export function validateBenchmark(benchmark: PackageBenchmark, iterations: number) {
  return benchmark.languageServiceBenchmarks.every(languageServiceBenchmark => {
    return languageServiceBenchmark.completionsDurations.length === iterations
      && languageServiceBenchmark.quickInfoDurations.length === iterations;
  });
}
