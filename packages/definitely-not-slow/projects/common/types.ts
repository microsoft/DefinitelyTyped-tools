export interface PackageBenchmark {
  packageName: string;
  packageVersion: string;
  typeScriptVersion: string;
  typeCount: number;
  relationCacheSizes: {
      assignable: number;
      identity: number;
      subtype: number;
  };
  languageServiceBenchmarks: LanguageServiceBenchmark[];
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
