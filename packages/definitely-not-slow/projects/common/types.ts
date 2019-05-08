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
  completions: LanguageServiceMeasurement[];
  quickInfo: LanguageServiceMeasurement[];
}

export enum LanguageServiceMeasurementTarget {
  QuickInfo = 1 << 0,
  Completions = 1 << 1,
  All = LanguageServiceMeasurementTarget.QuickInfo | LanguageServiceMeasurementTarget.Completions,
}

export interface LanguageServiceMeasurement {
  kind: LanguageServiceMeasurementTarget;
  fileName: string;
  identifierText: string;
  line: number;
  offset: number;
  start: number;
  end: number;
  durations: number[];
}

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
