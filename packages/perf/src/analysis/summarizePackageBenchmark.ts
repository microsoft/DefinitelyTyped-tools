import { PackageBenchmark, PackageBenchmarkSummary, StatSummary, LanguageServiceBenchmark } from "../common";
import { max, mean, median, stdDev, coefficientOfVariation } from "../measure/utils";

export function summarize(benchmark: PackageBenchmark): PackageBenchmarkSummary {
  return {
    packageName: benchmark.packageName,
    packageVersionMajor: benchmark.packageVersionMajor,
    packageVersionMinor: benchmark.packageVersionMinor,
    typeScriptVersion: benchmark.typeScriptVersion,
    typeScriptVersionMajorMinor: benchmark.typeScriptVersionMajorMinor,
    sourceVersion: benchmark.sourceVersion,
    typeCount: benchmark.typeCount,
    memoryUsage: benchmark.memoryUsage,
    relationCacheSizes: benchmark.relationCacheSizes,
    benchmarkDuration: benchmark.benchmarkDuration,
    batchRunStart: benchmark.batchRunStart,
    testIdentifierCount: benchmark.testIdentifierCount,
    requestedLanguageServiceTestIterations: benchmark.requestedLanguageServiceTestIterations,
    languageServiceCrashed: benchmark.languageServiceCrashed,
    ...summarizeStats(benchmark.languageServiceBenchmarks)
  };
}

export function summarizeStats(
  benchmarks: LanguageServiceBenchmark[]
): Pick<PackageBenchmarkSummary, "quickInfo" | "completions"> {
  return [
    ["completions", (benchmark: LanguageServiceBenchmark) => benchmark.completionsDurations] as const,
    ["quickInfo", (benchmark: LanguageServiceBenchmark) => benchmark.quickInfoDurations] as const
  ].reduce((acc, [key, getDurations]) => {
    const [means, cvs] = benchmarks.reduce(
      (acc, b) => {
        const durations = getDurations(b);
        acc[0].push(mean(durations));
        acc[1].push(coefficientOfVariation(durations));
        return acc;
      },
      [[], []] as [number[], number[]]
    );

    const worst = max(benchmarks, b => mean(getDurations(b)));
    const stats: StatSummary<LanguageServiceBenchmark> = {
      mean: mean(means),
      median: median(means),
      standardDeviation: stdDev(means),
      meanCoefficientOfVariation: mean(cvs),
      trials: means.length,
      worst
    };

    return {
      ...acc,
      [key]: stats
    };
  }, {} as Record<"completions" | "quickInfo", StatSummary<LanguageServiceBenchmark>>);
}
