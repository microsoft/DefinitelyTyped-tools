import { PackageBenchmark, PackageBenchmarkSummary, StatSummary, LanguageServiceBenchmark } from '../common';
export declare function summarize(benchmark: PackageBenchmark): PackageBenchmarkSummary;
export declare function summarizeStats(benchmarks: LanguageServiceBenchmark[]): {
    quickInfo: StatSummary<LanguageServiceBenchmark>;
    completions: StatSummary<LanguageServiceBenchmark>;
};
