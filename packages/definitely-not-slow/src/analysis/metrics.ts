import { mean } from '../measure/utils';
import { PackageBenchmarkSummary, Document, config, getPercentDiff } from '../common';
import { isNumber } from 'util';

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
    return SignificanceLevel.Alert;
  }
  if (percentDiff > config.comparison.percentDiffWarningThreshold) {
    return SignificanceLevel.Warning;
  }
  if (percentDiff < config.comparison.percentDiffGoldStarThreshold) {
    return SignificanceLevel.Awesome;
  }
}

const getInsignificant = () => undefined;

function getSignificanceProportionalTo(proportionalTo: MetricName) {
  return (percentDiff: number, before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>) => {
    const proportionalToBeforeValue = metrics[proportionalTo].getValue(before);
    const proportionalToAfterValue = metrics[proportionalTo].getValue(after);
    if (typeof proportionalToBeforeValue === 'number' && typeof proportionalToAfterValue === 'number') {
      const proportionalToPercentDiff = getPercentDiff(proportionalToAfterValue, proportionalToBeforeValue);
      return defaultGetSignificance(percentDiff - proportionalToPercentDiff);
    }
  };
}

export const metrics: { [K in MetricName]: Metric } = {
  typeCount: {
    columnName: 'Type count',
    sentenceName: 'type count',
    formatOptions: { precision: 0 },
    getValue: x => x.body.typeCount,
    getSignificance: getSignificanceProportionalTo('identifierCount'),
  },
  assignabilityCacheSize: {
    columnName: 'Assignability cache size',
    sentenceName: 'assignability cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.assignable,
    getSignificance: getSignificanceProportionalTo('identifierCount'),
  },
  subtypeCacheSize: {
    columnName: 'Subtype cache size',
    sentenceName: 'subtype cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.subtype,
    getSignificance: getSignificanceProportionalTo('identifierCount'),
  },
  identityCacheSize: {
    columnName: 'Identity cache size',
    sentenceName: 'identity cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.identity,
    getSignificance: getSignificanceProportionalTo('identifierCount'),
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

export function getInterestingMetrics(before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>) {
  return Object.values(metrics).reduce((acc: { metric: Metric, percentDiff: number, significance: SignificanceLevel }[], metric) => {
    const aValue = metric.getValue(before);
    const bValue = metric.getValue(after);
    const percentDiff = isNumber(aValue) && isNumber(bValue) && getPercentDiff(bValue, aValue);
    const significance = typeof percentDiff === 'number' && metric.getSignificance(percentDiff, before, after);
    if (percentDiff && significance) {
      return [
        ...acc,
        { metric, percentDiff, significance },
      ];
    }
    return acc;
  }, []);
}
