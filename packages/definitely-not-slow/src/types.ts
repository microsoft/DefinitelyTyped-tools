export interface PackageMeasurement {
  typeCount: number;
  relationCacheSizes: {
      assignable: number;
      identity: number;
      subtype: number;
  };
  completions: CompletionMeasurement[];
}

export interface CompletionMeasurement {
  fileName: string;
  identifierText: string;
  completionsCount: number;
  line: number;
  offset: number;
  start: number;
  end: number;
  duration: number;
  iterations: number;
  standardDeviation: number;
}
