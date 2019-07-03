import { mean } from '../measure/utils';
import { PackageBenchmarkSummary, Document, config, getPercentDiff, supportsMemoryUsage } from '../common';

export interface FormatOptions {
  precision?: number;
  indent?: number;
  percentage?: boolean;
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
  | 'memoryUsage'
  | 'assignabilityCacheSize'
  | 'subtypeCacheSize'
  | 'identityCacheSize'
  | 'samplesTaken'
  | 'identifierCount'
  | 'completionsMean'
  | 'completionsMedian'
  | 'completionsStdDev'
  | 'completionsAvgCV'
  | 'quickInfoMean'
  | 'quickInfoMedian'
  | 'quickInfoStdDev'
  | 'quickInfoAvgCV'
  | 'completionsWorstMean'
  | 'quickInfoWorstMean';

function defaultGetSignificance(percentDiff: number): SignificanceLevel | undefined {
  if (percentDiff > config.comparison.percentDiffAlertThreshold) {
    return SignificanceLevel.Alert;
  }
  if (percentDiff > config.comparison.percentDiffWarningThreshold) {
    return SignificanceLevel.Warning;
  }
  if (percentDiff < config.comparison.percentDiffAwesomeThreshold) {
    return SignificanceLevel.Awesome;
  }
}

const getInsignificant = () => undefined;

function getSignificanceProportionalTo(proportionalTo: MetricName, getSignificance = defaultGetSignificance) {
  return (percentDiff: number, before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>) => {
    const proportionalToBeforeValue = metrics[proportionalTo].getValue(before);
    const proportionalToAfterValue = metrics[proportionalTo].getValue(after);
    if (typeof proportionalToBeforeValue === 'number' && typeof proportionalToAfterValue === 'number') {
      const proportionalToPercentDiff = getPercentDiff(proportionalToAfterValue, proportionalToBeforeValue);
      const defaultSignificance = getSignificance(percentDiff);
      const weightedSignificance = getSignificance(percentDiff - proportionalToPercentDiff);
      // Can’t give out a gold star unless it’s absolutely better, otherwise it looks really confusing
      // when type count increased by 400% and that gets treated as “awesome” when identifier count
      // increased by 500%. It may _be_ awesome, but it looks confusing.
      if (weightedSignificance === SignificanceLevel.Awesome && defaultSignificance !== SignificanceLevel.Awesome) {
        return undefined;
      }
      return weightedSignificance;
    }
  };
}

function getOrderOfMagnitudeSignificance(percentDiff: number): SignificanceLevel | undefined {
  if (percentDiff > 10) { // decimal: 10 = 1000% = 10x increase
    return SignificanceLevel.Alert;
  }
  if (percentDiff > 5) {
    return SignificanceLevel.Warning;
  }
  if (percentDiff < -5) {
    return SignificanceLevel.Awesome;
  }
}

export const metrics: { [K in MetricName]: Metric } = {
  typeCount: {
    columnName: 'Type count',
    sentenceName: 'type count',
    formatOptions: { precision: 0 },
    getValue: x => x.body.typeCount,
    getSignificance: getSignificanceProportionalTo('identifierCount', getOrderOfMagnitudeSignificance),
  },
  memoryUsage: {
    columnName: 'Memory usage (MiB)',
    sentenceName: 'memory usage',
    getValue: x => x.body.memoryUsage / 2 ** 20,
    getSignificance: (percentDiff, before, after) => {
      if (supportsMemoryUsage(before) && supportsMemoryUsage(after)) {
        return getSignificanceProportionalTo('identifierCount', getOrderOfMagnitudeSignificance)(percentDiff, before, after);
      }
      return getInsignificant();
    }
  },
  assignabilityCacheSize: {
    columnName: 'Assignability cache size',
    sentenceName: 'assignability cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.assignable,
    getSignificance: getSignificanceProportionalTo('identifierCount', getOrderOfMagnitudeSignificance),
  },
  subtypeCacheSize: {
    columnName: 'Subtype cache size',
    sentenceName: 'subtype cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.subtype,
    getSignificance: getSignificanceProportionalTo('identifierCount', getOrderOfMagnitudeSignificance),
  },
  identityCacheSize: {
    columnName: 'Identity cache size',
    sentenceName: 'identity cache size',
    formatOptions: { precision: 0 },
    getValue: x => x.body.relationCacheSizes && x.body.relationCacheSizes.identity,
    getSignificance: getSignificanceProportionalTo('identifierCount', getOrderOfMagnitudeSignificance),
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
  completionsAvgCV: {
    columnName: 'Mean CV',
    sentenceName: 'mean coefficient of variation of samples measured for completions time',
    getValue: x => x.body.completions.meanCoefficientOfVariation,
    getSignificance: getInsignificant,
    formatOptions: { percentage: true },
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
  quickInfoAvgCV: {
    columnName: 'Mean CV',
    sentenceName: 'mean coefficient of variation of samples measured for quick info time',
    getValue: x => x.body.quickInfo.meanCoefficientOfVariation,
    getSignificance: getInsignificant,
    formatOptions: { percentage: true },
  },
  quickInfoWorstMean: {
    columnName: 'Worst duration (ms)',
    sentenceName: 'worst-case duration for getting quick info at a position',
    getValue: x => mean(x.body.quickInfo.worst.quickInfoDurations),
    getSignificance: defaultGetSignificance,
  },
};

export interface ComparedMetric {
  metric: Metric;
  percentDiff: number;
  significance: SignificanceLevel;
}

export function getInterestingMetrics(before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>): ComparedMetric[] {
  return Object.values(metrics).reduce((acc: { metric: Metric, percentDiff: number, significance: SignificanceLevel }[], metric) => {
    const aValue = metric.getValue(before);
    const bValue = metric.getValue(after);
    const percentDiff = isNonNaNNumber(aValue) && isNonNaNNumber(bValue) && getPercentDiff(bValue, aValue);
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

function isNonNaNNumber(n: any): n is number {
  return typeof n === 'number' && !isNaN(n);
}
