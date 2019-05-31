import { mean } from '../measure/utils';
import { PackageBenchmarkSummary, Document, config } from '../common';

export interface FormatOptions {
  precision?: number;
  indent?: number;
}

export const enum SignificanceLevel {
  Warning = 'warning',
  Alert = 'alert',
  Awesome = 'awesome',
}

export interface Metric {
  columnName: string;
  sentenceName: string;
  formatOptions?: FormatOptions;
  getValue: (x: Document<PackageBenchmarkSummary>) => number | undefined;
  getSignificance: (
    percentDiff: number,
    before: Document<PackageBenchmarkSummary>,
    after: Document<PackageBenchmarkSummary>
  ) => SignificanceLevel | undefined;
}

export type MetricName =
  | 'typeCount'
  // | 'memoryUsage'
  | 'assignabilityCacheSize'
  | 'subtypeCacheSize'
  | 'identityCacheSize'
  | 'samplesTaken'
  | 'identifierCount'
  | 'completionsMean'
  | 'completionsMedian'
  | 'completionsStdDev'
  | 'quickInfoMean'
  | 'quickInfoMedian'
  | 'quickInfoStdDev'
  | 'completionsWorstMean'
  | 'quickInfoWorstMean';

function defaultGetSignificance(percentDiff: number): SignificanceLevel | undefined {
  if (percentDiff > config.comparison.percentDiffSevereThreshold) {
    return SignificanceLevel.Warning;
  }
  if (percentDiff > config.comparison.percentDiffWarningThreshold) {
    return SignificanceLevel.Alert;
  }
  if (percentDiff < config.comparison.percentDiffGoldStarThreshold) {
    return SignificanceLevel.Awesome;
  }
}

const getInsignificant = () => undefined;

export const metrics: { [K in MetricName]: Metric } = {
  typeCount: {
    columnName: 'Type count',
    sentenceName: 'type count',
    formatOptions: { precision: 0 },
    getValue: x => x.body.typeCount,
    getSignificance: defaultGetSignificance,
  },
  assignabilityCacheSize: {
    columnName: 'Assignability cache size',
    sentenceName: 'assignability cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.assignable,
    getSignificance: defaultGetSignificance,
  },
  subtypeCacheSize: {
    columnName: 'Subtype cache size',
    sentenceName: 'subtype cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.subtype,
    getSignificance: defaultGetSignificance,
  },
  identityCacheSize: {
    columnName: 'Identity cache size',
    sentenceName: 'identity cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.identity,
    getSignificance: defaultGetSignificance,
  },
  samplesTaken: {
    columnName: 'Samples taken',
    sentenceName: 'number of samples taken',
    formatOptions: { precision: 0 },
    getValue: x => Math.max(x.body.completions.trials, x.body.quickInfo.trials),
    getSignificance: getInsignificant,
  },
  identifierCount: {
    columnName: 'Identifiers in tests',
    sentenceName: 'number of identifiers present in test files',
    formatOptions: { precision: 0 },
    getValue: x => x.body.testIdentifierCount,
    getSignificance: getInsignificant,
  },
  completionsMean: {
    columnName: 'Mean duration (ms)',
    sentenceName: 'mean duration for getting completions at a position',
    getValue: x => x.body.completions.mean,
    getSignificance: defaultGetSignificance,
  },
  completionsMedian: {
    columnName: 'Median duration (ms)',
    sentenceName: 'median duration for getting completions at a position',
    getValue: x => x.body.completions.median,
    getSignificance: defaultGetSignificance,
  },
  completionsStdDev: {
    columnName: 'Std. deviation (ms)',
    sentenceName: 'standard deviation of the durations for getting completions at a position',
    getValue: x => x.body.completions.standardDeviation,
    getSignificance: getInsignificant,
  },
  completionsWorstMean: {
    columnName: 'Worst duration (ms)',
    sentenceName: 'worst-case duration for getting completions at a position',
    getValue: x => mean(x.body.completions.worst.completionsDurations),
    getSignificance: defaultGetSignificance,
  },
  quickInfoMean: {
    columnName: 'Mean duration (ms)',
    sentenceName: 'mean duration for getting quick info at a position',
    getValue: x => x.body.quickInfo.mean,
    getSignificance: defaultGetSignificance,
  },
  quickInfoMedian: {
    columnName: 'Median duration (ms)',
    sentenceName: 'median duration for getting quick info at a position',
    getValue: x => x.body.quickInfo.median,
    getSignificance: defaultGetSignificance,
  },
  quickInfoStdDev: {
    columnName: 'Std. deviation (ms)',
    sentenceName: 'standard deviation of the durations for getting quick info at a position',
    getValue: x => x.body.quickInfo.standardDeviation,
    getSignificance: getInsignificant,
  },
  quickInfoWorstMean: {
    columnName: 'Worst duration (ms)',
    sentenceName: 'worst-case duration for getting quick info at a position',
    getValue: x => mean(x.body.quickInfo.worst.quickInfoDurations),
    getSignificance: defaultGetSignificance,
  },
};