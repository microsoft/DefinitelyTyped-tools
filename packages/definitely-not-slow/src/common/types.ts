import { CpuInfo } from 'os';

export type RelationCacheSizes = {
  assignable: number;
  identity: number;
  subtype: number;
};

export interface PackageBenchmark {
  batchRunStart: Date;
  packageName: string;
  packageVersion: string;
  sourceVersion: string;
  typeScriptVersion: string;
  typeScriptVersionMajorMinor: string;
  typeCount: number;
  benchmarkDuration: number;
  relationCacheSizes?: RelationCacheSizes;
  testIdentifierCount: number;
  requestedLanguageServiceTestIterations: number;
  languageServiceBenchmarks: LanguageServiceBenchmark[];
}

export interface PackageBenchmarkSummary {
  batchRunStart: Date;
  packageName: string;
  packageVersion: string;
  typeScriptVersion: string;
  typeScriptVersionMajorMinor: string;
  sourceVersion: string;
  typeCount: number;
  benchmarkDuration: number;
  relationCacheSizes?: RelationCacheSizes;
  testIdentifierCount: number;
  requestedLanguageServiceTestIterations: number;
  completions: StatSummary<LanguageServiceBenchmark>;
  quickInfo: StatSummary<LanguageServiceBenchmark>;
}

export interface StatSummary<T> {
  mean: number;
  median: number;
  standardDeviation: number;
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
  cpus: Omit<CpuInfo, 'times'>[];
  arch: string;
  platform: string;
  release: string;
  totalmem: number;
  hash: string;
}

export interface Document<T> {
  version: number;
  createdAt: Date;
  system: SystemInfo;
  body: T;
}

type Serializable<T extends {}> = {
  [K in keyof T]:
    T[K] extends string ? string :
    T[K] extends number ? number :
    T[K] extends boolean ? boolean :
    T[K] extends Date ? string :
    T[K] extends ReadonlyArray<infer U> ? Serializable<U>[] :
    T[K] extends {} ? Serializable<T> :
    never;
};

export interface JSONDocument<T extends {}> {
  version: number;
  createdAt: string;
  system: SystemInfo;
  body: Serializable<T>;
}