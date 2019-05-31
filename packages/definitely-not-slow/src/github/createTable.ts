import table from 'markdown-table';
import { PackageBenchmarkSummary, Document, config, getPercentDiff } from '../common';
import { metrics, Metric, FormatOptions } from './metrics';

export function createComparisonTable(before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>, beforeTitle: string, afterTitle: string) {
  return table([
    ['', beforeTitle, afterTitle, 'diff'],
    ['**Batch compilation**'],
    // createComparisonRowFromMetric(metrics.memoryUsage, before, after),
    createComparisonRowFromMetric(metrics.typeCount, before, after),
    createComparisonRowFromMetric(metrics.assignabilityCacheSize, before, after),
    createComparisonRowFromMetric(metrics.subtypeCacheSize, before, after),
    createComparisonRowFromMetric(metrics.identityCacheSize, before, after),
    [],
    ['**Language service**'],
    createComparisonRowFromMetric(metrics.samplesTaken, before, after),
    createComparisonRowFromMetric(metrics.identifierCount, before, after),
    ['**`getCompletionsAtPosition`**'], 
    createComparisonRowFromMetric(metrics.completionsMean, before, after, { indent: 1 }),
    createComparisonRowFromMetric(metrics.completionsMedian, before, after, { indent: 1 }),
    createComparisonRowFromMetric(metrics.completionsStdDev, before, after, { indent: 1 }),
    createComparisonRowFromMetric(metrics.completionsWorstMean, before, after, { indent: 1 }),
    createComparisonRow('Worst identifier', before, after, x => sourceLink(
      x.body.completions.worst.identifierText,
      x.body.sourceVersion,
      x.body.completions.worst.fileName,
      x.body.completions.worst.line), { indent: 1 }),
    ['**`getQuickInfoAtPosition`**'],
    createComparisonRowFromMetric(metrics.quickInfoMean, before, after, { indent: 1 }),
    createComparisonRowFromMetric(metrics.quickInfoMedian, before, after, { indent: 1 }),
    createComparisonRowFromMetric(metrics.quickInfoStdDev, before, after, { indent: 1 }),
    createComparisonRowFromMetric(metrics.quickInfoWorstMean, before, after, { indent: 1 }),
    createComparisonRow('Worst identifier', before, after, x => sourceLink(
      x.body.quickInfo.worst.identifierText,
      x.body.sourceVersion,
      x.body.quickInfo.worst.fileName,
      x.body.quickInfo.worst.line), { indent: 1 }),
    [],
    ['**System information**'],
    createComparisonRow('Node version', before, after, x => x.system.nodeVersion),
    createComparisonRow('CPU count', before, after, x => x.system.cpus.length, { precision: 0 }),
    createComparisonRow('CPU speed', before, after, x => `${x.system.cpus[0].speed / 1000} GHz`),
    createComparisonRow('CPU model', before, after, x => x.system.cpus[0].model),
    createComparisonRow('CPU Architecture', before, after, x => x.system.arch),
    createComparisonRow('Memory', before, after, x => `${format(x.system.totalmem / 2 ** 30)} GiB`),
    createComparisonRow('Platform', before, after, x => x.system.platform),
    createComparisonRow('Release', before, after, x => x.system.release),
  ]);
}

export function createSingleRunTable(benchmark: Document<PackageBenchmarkSummary>) {
  return table([
    ['**Batch compilation**'],
    // createSingleRunRowFromMetric(metrics.memoryUsage, benchmark),
    createSingleRunRowFromMetric(metrics.typeCount, benchmark),
    createSingleRunRowFromMetric(metrics.assignabilityCacheSize, benchmark),
    createSingleRunRowFromMetric(metrics.subtypeCacheSize, benchmark),
    createSingleRunRowFromMetric(metrics.identityCacheSize, benchmark),
    [],
    ['**Language service measurements**'],
    createSingleRunRowFromMetric(metrics.samplesTaken, benchmark),
    createSingleRunRowFromMetric(metrics.identifierCount, benchmark),
    ['**`getCompletionsAtPosition`**'], 
    createSingleRunRowFromMetric(metrics.completionsMean, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.completionsMedian, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.completionsStdDev, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.completionsWorstMean, benchmark, { indent: 1 }),
    createSingleRunRow('Worst identifier', benchmark, x => sourceLink(
      x.body.completions.worst.identifierText,
      x.body.sourceVersion,
      x.body.completions.worst.fileName,
      x.body.completions.worst.line), { indent: 1 }),
    ['**`getQuickInfoAtPosition`**'],
    createSingleRunRowFromMetric(metrics.quickInfoMean, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.quickInfoMedian, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.quickInfoStdDev, benchmark, { indent: 1 }),
    createSingleRunRowFromMetric(metrics.quickInfoWorstMean, benchmark, { indent: 1 }),
    createSingleRunRow('Worst identifier', benchmark, x => sourceLink(
      x.body.quickInfo.worst.identifierText,
      x.body.sourceVersion,
      x.body.quickInfo.worst.fileName,
      x.body.quickInfo.worst.line), { indent: 1 }),
    [],
    ['**System information**'],
    createSingleRunRow('Node version', benchmark, x => x.system.nodeVersion),
    createSingleRunRow('CPU count', benchmark, x => x.system.cpus.length, { precision: 0 }),
    createSingleRunRow('CPU speed', benchmark, x => `${x.system.cpus[0].speed / 1000} GHz`),
    createSingleRunRow('CPU model', benchmark, x => x.system.cpus[0].model),
    createSingleRunRow('CPU Architecture', benchmark, x => x.system.arch),
    createSingleRunRow('Memory', benchmark, x => `${format(x.system.totalmem / 2 ** 30)} GiB`),
    createSingleRunRow('Platform', benchmark, x => x.system.platform),
    createSingleRunRow('Release', benchmark, x => x.system.release),
  ]);
}

function sourceLink(text: string, sourceVersion: string, fileName: string, line: number) {
  return `[${text}](/${config.github.commonParams.owner}/${config.github.commonParams.repo}/blob/${sourceVersion.replace('\n', '')}/${fileName}#L${line})`;
}

function createComparisonRowFromMetric(metric: Metric, a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>, formatOptions?: FormatOptions) {
  return createComparisonRow(metric.columnName, a, b, metric.getValue, { ...metric.formatOptions, ...formatOptions });
}

function createSingleRunRowFromMetric(metric: Metric, benchmark: Document<PackageBenchmarkSummary>, formatOptions?: FormatOptions) {
  return createSingleRunRow(metric.columnName, benchmark, metric.getValue, { ...metric.formatOptions, ...formatOptions });
}

function createComparisonRow(
  title: string,
  a: Document<PackageBenchmarkSummary>,
  b: Document<PackageBenchmarkSummary>,
  getValue: (x: Document<PackageBenchmarkSummary>) => number | string | undefined,
  formatOptions: FormatOptions = {},
) {
  const aValue = getValue(a);
  const bValue = getValue(b);
  const percentDiff = !formatOptions.noDiff && typeof aValue === 'number' && typeof bValue === 'number' && !isNaN(bValue) && !isNaN(bValue)
    ? getPercentDiff(bValue, aValue)
    : undefined;
  
  return [
    indent(title, formatOptions.indent || 0),
    format(aValue, formatOptions.precision),
    format(bValue, formatOptions.precision),
    typeof percentDiff === 'number' ? formatDiff(percentDiff, formatOptions.higherIsBetter, formatOptions.includeEmoji, formatOptions.precision) : '',
  ];
}

function createSingleRunRow(
  title: string,
  benchmark: Document<PackageBenchmarkSummary>,
  getValue: (x: Document<PackageBenchmarkSummary>) => number | string | undefined,
  formatOptions: FormatOptions = {}
) {
  const value = getValue(benchmark);

  return [
    indent(title, formatOptions.indent || 0),
    format(value, formatOptions.precision),
  ];
}

function indent(text: string, level: number) {
  return '&nbsp;'.repeat(4 * level) + text;
}

function formatDiff(percentDiff: number, higherIsBetter = false, includeEmoji = true, precision?: number) {
  const percentString = format(percentDiff * 100, precision, '%', true);
  const valueToCompare = higherIsBetter ? percentDiff * -1 : percentDiff;
  if (valueToCompare > config.comparison.percentDiffSevereThreshold) {
    return `**${percentString}**&nbsp;🚨`;
  }
  if (valueToCompare > config.comparison.percentDiffWarningThreshold) {
    return `**${percentString}**&nbsp;🔸`;
  }
  if (valueToCompare < config.comparison.percentDiffGoldStarThreshold) {
    return `**${percentString}**&nbsp;🌟`;
  }
  return percentString;
}

function format(x: string | number | undefined, precision = 1, unit = '', showPlusSign?: boolean): string {
  switch (typeof x) {
    case 'string': return x + unit;
    case 'number':
      if (isNaN(x)) return '';
      let numString = x.toFixed(precision).replace(/^-0(\.0*)?$/, '0$1');
      if (showPlusSign && !/^0(\.0*)?$/.test(numString)) numString = `+${numString}`;
      return numString + unit;
    default: return '';
  }
}
