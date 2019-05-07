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

export interface LanguageServiceMeasurement {
  fileName: string;
  identifierText: string;
  line: number;
  offset: number;
  start: number;
  end: number;
  duration: number;
  iterations: number;
  standardDeviation: number;
}
