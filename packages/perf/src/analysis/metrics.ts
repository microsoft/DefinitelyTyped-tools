import { mean } from "../measure/utils";
import { PackageBenchmarkSummary, config, getPercentDiff } from "../common";
import { assertNever } from "@definitelytyped/utils";

export interface FormatOptions {
  precision?: number;
  indent?: number;
  percentage?: boolean;
  noDiff?: boolean;
}

export const enum SignificanceLevel {
  Warning = "warning",
  Alert = "alert",
  Awesome = "awesome"
}

export type GetSignificance = (
  percentDiff: number,
  beforeValue: number,
  afterValue: number,
  beforeDoc: PackageBenchmarkSummary,
  afterDoc: PackageBenchmarkSummary
) => SignificanceLevel | undefined;

export type CreateGetSignificance = (getSignificance: GetSignificance) => GetSignificance;

export interface Metric {
  columnName: string;
  sentenceName: string;
  formatOptions?: FormatOptions;
  getValue: (x: PackageBenchmarkSummary) => number | undefined;
  getSignificance: GetSignificance;
}

export type MetricName =
  | "typeCount"
  | "memoryUsage"
  | "assignabilityCacheSize"
  | "samplesTaken"
  | "identifierCount"
  | "completionsMean"
  | "completionsStdDev"
  | "completionsAvgCV"
  | "quickInfoMean"
  | "quickInfoStdDev"
  | "quickInfoAvgCV"
  | "completionsWorstMean"
  | "quickInfoWorstMean";

function getDefaultSignificance(percentDiff: number): SignificanceLevel | undefined {
  if (percentDiff > config.comparison.percentDiffAlertThreshold) {
    return SignificanceLevel.Alert;
  }
  if (percentDiff > config.comparison.percentDiffWarningThreshold) {
    return SignificanceLevel.Warning;
  }
  if (percentDiff < config.comparison.percentDiffAwesomeThreshold) {
    return SignificanceLevel.Awesome;
  }
  return;
}

function getOrderOfMagnitudeSignificance(percentDiff: number): SignificanceLevel | undefined {
  if (percentDiff > 10) {
    // decimal: 10 = 1000% = 10x increase
    return SignificanceLevel.Alert;
  }
  if (percentDiff > 5) {
    return SignificanceLevel.Warning;
  }
  if (percentDiff < -5) {
    return SignificanceLevel.Awesome;
  }
  return;
}

const getInsignificant = () => undefined;

function proportionalTo(proportionalTo: MetricName) {
  return (getSignificance: GetSignificance): GetSignificance => (
    percentDiff,
    beforeValue,
    afterValue,
    beforeDoc,
    afterDoc
  ) => {
    const proportionalToBeforeValue = metrics[proportionalTo].getValue(beforeDoc);
    const proportionalToAfterValue = metrics[proportionalTo].getValue(afterDoc);
    if (typeof proportionalToBeforeValue === "number" && typeof proportionalToAfterValue === "number") {
      const proportionalToPercentDiff = getPercentDiff(proportionalToAfterValue, proportionalToBeforeValue);
      const defaultSignificance = getSignificance(percentDiff, beforeValue, afterValue, beforeDoc, afterDoc);
      const weightedSignificance = getSignificance(
        percentDiff - proportionalToPercentDiff,
        beforeValue,
        afterValue,
        beforeDoc,
        afterDoc
      );
      // Can’t give out a gold star unless it’s absolutely better, otherwise it looks really confusing
      // when type count increased by 400% and that gets treated as “awesome” when identifier count
      // increased by 500%. It may _be_ awesome, but it looks confusing.
      if (weightedSignificance === SignificanceLevel.Awesome && defaultSignificance !== SignificanceLevel.Awesome) {
        return undefined;
      }
      return weightedSignificance;
    }
    return;
  };
}

enum FineIf {
  LessThan = -1,
  GreaterThanOrEqualTo = 1
}

function withThreshold(fineIf: FineIf, threshold: number) {
  return (getSignificance: GetSignificance): GetSignificance => (
    percentDiff,
    beforeValue,
    afterValue,
    beforeDoc,
    afterDoc
  ) => {
    const significance = getSignificance(percentDiff, beforeValue, afterValue, beforeDoc, afterDoc);
    if (afterValue * fineIf >= threshold * fineIf) {
      switch (significance) {
        case undefined:
        case SignificanceLevel.Alert:
        case SignificanceLevel.Warning:
          return undefined;
        case SignificanceLevel.Awesome:
          return significance;
        default:
          assertNever(significance);
      }
    }
    return significance;
  };
}

function compose(x: CreateGetSignificance, ...xs: CreateGetSignificance[]): CreateGetSignificance {
  return getSignificance => {
    let current = x(getSignificance);
    while ((x = xs.pop()!)) {
      current = x(current);
    }
    return current;
  };
}

export const metrics: { [K in MetricName]: Metric } = {
  typeCount: {
    columnName: "Type count",
    sentenceName: "type count",
    formatOptions: { precision: 0 },
    getValue: x => x.typeCount,
    getSignificance: compose(
      proportionalTo("identifierCount"),
      withThreshold(FineIf.LessThan, 5000)
    )(getOrderOfMagnitudeSignificance)
  },
  memoryUsage: {
    columnName: "Memory usage (MiB)",
    sentenceName: "memory usage",
    getValue: x => x.memoryUsage / 2 ** 20,
    getSignificance: compose(
      proportionalTo("identifierCount"),
      withThreshold(FineIf.LessThan, 65),
    )(getOrderOfMagnitudeSignificance)
  },
  assignabilityCacheSize: {
    columnName: "Assignability cache size",
    sentenceName: "assignability cache size",
    formatOptions: { precision: 0 },
    getValue: x => x.relationCacheSizes && x.relationCacheSizes.assignable,
    getSignificance: compose(
      proportionalTo("identifierCount"),
      withThreshold(FineIf.LessThan, 1000)
    )(getOrderOfMagnitudeSignificance)
  },
  samplesTaken: {
    columnName: "Samples taken",
    sentenceName: "number of samples taken",
    formatOptions: { precision: 0 },
    getValue: x => Math.max(x.completions.trials, x.quickInfo.trials),
    getSignificance: getInsignificant
  },
  identifierCount: {
    columnName: "Identifiers in tests",
    sentenceName: "number of identifiers present in test files",
    formatOptions: { precision: 0 },
    getValue: x => x.testIdentifierCount,
    getSignificance: getInsignificant
  },
  completionsMean: {
    columnName: "Mean duration (ms)",
    sentenceName: "mean duration for getting completions at a position",
    getValue: x => x.completions.mean,
    getSignificance: withThreshold(FineIf.LessThan, 150)(getDefaultSignificance)
  },
  completionsStdDev: {
    columnName: "Std. deviation (ms)",
    sentenceName: "standard deviation of the durations for getting completions at a position",
    getValue: x => x.completions.standardDeviation,
    getSignificance: getInsignificant
  },
  completionsAvgCV: {
    columnName: "Mean [CV](https://en.wikipedia.org/wiki/Coefficient_of_variation)",
    sentenceName: "mean coefficient of variation of samples measured for completions time",
    getValue: x => x.completions.meanCoefficientOfVariation,
    getSignificance: getInsignificant,
    formatOptions: { percentage: true, noDiff: true }
  },
  completionsWorstMean: {
    columnName: "Worst duration (ms)",
    sentenceName: "worst-case duration for getting completions at a position",
    getValue: x => mean(x.completions.worst.completionsDurations),
    getSignificance: withThreshold(FineIf.LessThan, 200)(getDefaultSignificance)
  },
  quickInfoMean: {
    columnName: "Mean duration (ms)",
    sentenceName: "mean duration for getting quick info at a position",
    getValue: x => x.quickInfo.mean,
    getSignificance: withThreshold(FineIf.LessThan, 150)(getDefaultSignificance)
  },
  quickInfoStdDev: {
    columnName: "Std. deviation (ms)",
    sentenceName: "standard deviation of the durations for getting quick info at a position",
    getValue: x => x.quickInfo.standardDeviation,
    getSignificance: getInsignificant
  },
  quickInfoAvgCV: {
    columnName: "Mean [CV](https://en.wikipedia.org/wiki/Coefficient_of_variation)",
    sentenceName: "mean coefficient of variation of samples measured for quick info time",
    getValue: x => x.quickInfo.meanCoefficientOfVariation,
    getSignificance: getInsignificant,
    formatOptions: { percentage: true, noDiff: true }
  },
  quickInfoWorstMean: {
    columnName: "Worst duration (ms)",
    sentenceName: "worst-case duration for getting quick info at a position",
    getValue: x => mean(x.quickInfo.worst.quickInfoDurations),
    getSignificance: withThreshold(FineIf.LessThan, 200)(getDefaultSignificance)
  }
};

export interface ComparedMetric {
  metric: Metric;
  percentDiff: number;
  significance: SignificanceLevel;
}

export function getInterestingMetrics(
  before: PackageBenchmarkSummary,
  after: PackageBenchmarkSummary
): ComparedMetric[] {
  return Object.values(metrics).reduce(
    (acc: { metric: Metric; percentDiff: number; significance: SignificanceLevel }[], metric) => {
      const beforeValue = metric.getValue(before);
      const afterValue = metric.getValue(after);
      const percentDiff =
        isNonNaNNumber(beforeValue) && isNonNaNNumber(afterValue) && getPercentDiff(afterValue, beforeValue);
      const significance =
        typeof percentDiff === "number" &&
        metric.getSignificance(percentDiff, beforeValue!, afterValue!, before, after);
      if (percentDiff && significance) {
        return [...acc, { metric, percentDiff, significance }];
      }
      return acc;
    },
    []
  );
}

function isNonNaNNumber(n: any): n is number {
  return typeof n === "number" && !isNaN(n);
}
