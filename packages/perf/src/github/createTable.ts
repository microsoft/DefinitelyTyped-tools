import table from "markdown-table";
import { PackageBenchmarkSummary, config, getPercentDiff, compact } from "../common";
import { metrics, Metric, FormatOptions, SignificanceLevel } from "../analysis";
import { assertNever } from "@definitelytyped/utils";

export function createComparisonTable(
  before: PackageBenchmarkSummary,
  after: PackageBenchmarkSummary,
  beforeTitle: string,
  afterTitle: string
) {
  return table(
    compact([
      ["", beforeTitle, afterTitle, "diff"],
      ["**Batch compilation**"],
      createComparisonRowFromMetric(metrics.memoryUsage, before, after),
      createComparisonRowFromMetric(metrics.typeCount, before, after),
      createComparisonRowFromMetric(metrics.assignabilityCacheSize, before, after),
      [],
      ["**Language service**"],
      createComparisonRowFromMetric(metrics.samplesTaken, before, after),
      createComparisonRowFromMetric(metrics.identifierCount, before, after),
      ["**`getCompletionsAtPosition`**"],
      createComparisonRowFromMetric(metrics.completionsMean, before, after, { indent: 1 }),
      createComparisonRowFromMetric(metrics.completionsAvgCV, before, after, { indent: 1 }),
      createComparisonRowFromMetric(metrics.completionsWorstMean, before, after, { indent: 1 }),
      createComparisonRow(
        "Worst identifier",
        before,
        after,
        x =>
          sourceLink(
            x.completions.worst.identifierText,
            x.sourceVersion,
            x.completions.worst.fileName,
            x.completions.worst.line
          ),
        undefined,
        { indent: 1 }
      ),
      ["**`getQuickInfoAtPosition`**"],
      createComparisonRowFromMetric(metrics.quickInfoMean, before, after, { indent: 1 }),
      createComparisonRowFromMetric(metrics.quickInfoAvgCV, before, after, { indent: 1 }),
      createComparisonRowFromMetric(metrics.quickInfoWorstMean, before, after, { indent: 1 }),
      createComparisonRow(
        "Worst identifier",
        before,
        after,
        x =>
          sourceLink(
            x.quickInfo.worst.identifierText,
            x.sourceVersion,
            x.quickInfo.worst.fileName,
            x.quickInfo.worst.line
          ),
        undefined,
        { indent: 1 }
      )
    ])
  );
}

export function createSingleRunTable(benchmark: PackageBenchmarkSummary) {
  return table([
    ["**Batch compilation**"],
    // createSingleRunRowFromMetric(metrics.memoryUsage, benchmark),
    createSingleRunRowFromMetric(metrics.typeCount, benchmark),
    createSingleRunRowFromMetric(metrics.assignabilityCacheSize, benchmark),
    [],
    ["**Language service measurements**"],
    createSingleRunRowFromMetric(metrics.samplesTaken, benchmark),
    createSingleRunRowFromMetric(metrics.identifierCount, benchmark),
    ["**`getCompletionsAtPosition`**"],
    createSingleRunRowFromMetric(metrics.completionsMean, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.completionsAvgCV, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.completionsWorstMean, benchmark, { indent: 1 }),
    createSingleRunRow(
      "Worst identifier",
      benchmark,
      x =>
        sourceLink(
          x.completions.worst.identifierText,
          x.sourceVersion,
          x.completions.worst.fileName,
          x.completions.worst.line
        ),
      { indent: 1 }
    ),
    ["**`getQuickInfoAtPosition`**"],
    createSingleRunRowFromMetric(metrics.quickInfoMean, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.quickInfoAvgCV, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.quickInfoWorstMean, benchmark, { indent: 1 }),
    createSingleRunRow(
      "Worst identifier",
      benchmark,
      x =>
        sourceLink(
          x.quickInfo.worst.identifierText,
          x.sourceVersion,
          x.quickInfo.worst.fileName,
          x.quickInfo.worst.line
        ),
      { indent: 1 }
    )
  ]);
}

function sourceLink(text: string, sourceVersion: string, fileName: string, line: number) {
  return `[${text}](/${config.github.commonParams.owner}/${
    config.github.commonParams.repo
  }/blob/${sourceVersion.replace("\n", "")}/${fileName}#L${line})`;
}

function createComparisonRowFromMetric(
  metric: Metric,
  before: PackageBenchmarkSummary,
  after: PackageBenchmarkSummary,
  formatOptions: FormatOptions = {}
) {
  const beforeValue = metric.getValue(before);
  const afterValue = metric.getValue(after);
  const format = { ...metric.formatOptions, ...formatOptions };
  const percentDiff =
    !format.noDiff &&
    typeof beforeValue === "number" &&
    typeof afterValue === "number" &&
    !isNaN(afterValue) &&
    !isNaN(afterValue)
      ? getPercentDiff(afterValue, beforeValue)
      : undefined;
  const diffString =
    typeof percentDiff === "number"
      ? formatDiff(
          percentDiff,
          metric.getSignificance(percentDiff, beforeValue!, afterValue!, before, after),
          format.precision
        )
      : undefined;
  return createComparisonRow(metric.columnName, before, after, metric.getValue, diffString, format);
}

function createSingleRunRowFromMetric(
  metric: Metric,
  benchmark: PackageBenchmarkSummary,
  formatOptions?: FormatOptions
) {
  return createSingleRunRow(metric.columnName, benchmark, metric.getValue, {
    ...metric.formatOptions,
    ...formatOptions
  });
}

function createComparisonRow(
  title: string,
  a: PackageBenchmarkSummary,
  b: PackageBenchmarkSummary,
  getValue: (x: PackageBenchmarkSummary) => number | string | undefined,
  diff?: string,
  formatOptions: FormatOptions = {}
): string[] {
  const aValue = getValue(a);
  const bValue = getValue(b);

  return [
    indent(title, formatOptions.indent || 0),
    format(aValue, formatOptions),
    format(bValue, formatOptions),
    diff || ""
  ];
}

function createSingleRunRow(
  title: string,
  benchmark: PackageBenchmarkSummary,
  getValue: (x: PackageBenchmarkSummary) => number | string | undefined,
  formatOptions: FormatOptions = {}
): string[] {
  const value = getValue(benchmark);

  return [indent(title, formatOptions.indent || 0), format(value, formatOptions)];
}

function indent(text: string, level: number): string {
  return "&nbsp;".repeat(4 * level) + text;
}

export function formatDiff(
  percentDiff: number,
  significance: SignificanceLevel | undefined,
  precision?: number
): string {
  const percentString = format(percentDiff, { percentage: true, precision }, "%", true);
  if (!significance || !percentString) {
    return percentString;
  }

  switch (significance) {
    case SignificanceLevel.Warning:
      return `**${percentString}**&nbsp;🔸`;
    case SignificanceLevel.Alert:
      return `**${percentString}**&nbsp;🚨`;
    case SignificanceLevel.Awesome:
      return `**${percentString}**&nbsp;🌟`;
    default:
      return assertNever(significance);
  }
}

function format(
  x: string | number | undefined,
  { precision = 1, percentage }: FormatOptions = {},
  unit = percentage ? "%" : "",
  showPlusSign?: boolean
): string {
  switch (typeof x) {
    case "string":
      return x + unit;
    case "number":
      if (isNaN(x) || !isFinite(x)) return "";
      let numString = (percentage ? x * 100 : x).toFixed(precision).replace(/^-0(\.0*)?$/, "0$1");
      if (showPlusSign && x > 0 && !/^0(\.0*)?$/.test(numString)) numString = `+${numString}`;
      return numString + unit;
    default:
      return "";
  }
}
