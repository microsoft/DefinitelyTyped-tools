import { CpuInfo } from "os";

export interface RelationCacheSizes {
  assignable: number;
  identity: number;
  subtype: number;
}

export interface PackageBenchmark {
  batchRunStart: Date;
  packageName: string;
  packageVersionMajor: number;
  packageVersionMinor: number;
  sourceVersion: string;
  typeScriptVersion: string;
  typeScriptVersionMajorMinor: string;
  typeCount: number;
  memoryUsage: number;
  benchmarkDuration: number;
  relationCacheSizes?: RelationCacheSizes;
  testIdentifierCount: number;
  requestedLanguageServiceTestIterations: number;
  languageServiceCrashed: boolean;
  languageServiceBenchmarks: LanguageServiceBenchmark[];
}

export interface PackageBenchmarkSummary {
  batchRunStart: Date;
  packageName: string;
  packageVersionMajor: number;
  packageVersionMinor: number;
  typeScriptVersion: string;
  typeScriptVersionMajorMinor: string;
  sourceVersion: string;
  typeCount: number;
  memoryUsage: number;
  benchmarkDuration: number;
  relationCacheSizes?: RelationCacheSizes;
  testIdentifierCount: number;
  requestedLanguageServiceTestIterations: number;
  languageServiceCrashed: boolean;
  completions: StatSummary<LanguageServiceBenchmark>;
  quickInfo: StatSummary<LanguageServiceBenchmark>;
}

export interface TypeScriptComparisonRun {
  compareAgainstPackageBenchmarkId: string;
  sourceVersion: string;
  headBenchmark: PackageBenchmarkSummary;
}

export interface StatSummary<T> {
  mean: number;
  median: number;
  standardDeviation: number;
  meanCoefficientOfVariation: number;
  trials: number;
  worst: T;
}

export interface LanguageServiceBenchmark {
  fileName: string;
  identifierText: string;
  line: number;
  offset: number;
  start: number;
  end: number;
  quickInfoDurations: number[];
  completionsDurations: number[];
}

export interface LanguageServiceSingleMeasurement {
  fileName: string;
  start: number;
  quickInfoDuration: number;
  completionsDuration: number;
}

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export interface SystemInfo {
  cpus: Omit<CpuInfo, "times">[];
  arch: string;
  platform: string;
  release: string;
  totalmem: number;
  hash: string;
  nodeVersion: string;
}
