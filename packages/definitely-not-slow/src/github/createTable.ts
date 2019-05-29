import table from 'markdown-table';
import { PackageBenchmarkSummary, Document, config, getPercentDiff } from '../common';
import { metrics, Metric, FormatOptions } from './metrics';

export function createTable(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>, leftTitle: string, rightTitle: string) {
  return table([
    ['', leftTitle, rightTitle, 'diff'],
    ['**Batch compilation**'],
    createRowFromMetric(metrics.typeCount, a, b),
    createRowFromMetric(metrics.assignabilityCacheSize, a, b),
    createRowFromMetric(metrics.subtypeCacheSize, a, b),
    createRowFromMetric(metrics.identityCacheSize, a, b),
    [],
    ['**Language service measurements**'],
    createRowFromMetric(metrics.samplesTaken, a, b),
    createRowFromMetric(metrics.identifierCount, a, b),
    ['**`getCompletionsAtPosition`**'], 
    createRowFromMetric(metrics.completionsMean, a, b, { indent: 1 }),
    createRowFromMetric(metrics.completionsMedian, a, b, { indent: 1 }),
    createRowFromMetric(metrics.completionsStdDev, a, b, { indent: 1 }),
    createRowFromMetric(metrics.completionsWorstMean, a, b, { indent: 1 }),
    createRow('Worst identifier', a, b, x => sourceLink(
      x.body.completions.worst.identifierText,
      x.body.sourceVersion,
      x.body.completions.worst.fileName,
      x.body.completions.worst.line), { indent: 1 }),
    ['**`getQuickInfoAtPosition`**'],
    createRowFromMetric(metrics.quickInfoMean, a, b, { indent: 1 }),
    createRowFromMetric(metrics.quickInfoMedian, a, b, { indent: 1 }),
    createRowFromMetric(metrics.quickInfoStdDev, a, b, { indent: 1 }),
    createRowFromMetric(metrics.quickInfoWorstMean, a, b, { indent: 1 }),
    createRow('Worst identifier', a, b, x => sourceLink(
      x.body.quickInfo.worst.identifierText,
      x.body.sourceVersion,
      x.body.quickInfo.worst.fileName,
      x.body.quickInfo.worst.line), { indent: 1 }),
    [],
    ['**System information**'],
    createRow('CPU count', a, b, x => x.system.cpus.length, { precision: 0 }),
    createRow('CPU speed', a, b, x => `${x.system.cpus[0].speed / 1000} GHz`),
    createRow('CPU model', a, b, x => x.system.cpus[0].model),
    createRow('CPU Architecture', a, b, x => x.system.arch),
    createRow('Memory', a, b, x => `${format(x.system.totalmem / 2 ** 30)} GiB`),
    createRow('Platform', a, b, x => x.system.platform),
    createRow('Release', a, b, x => x.system.release),
  ]);
}

function sourceLink(text: string, sourceVersion: string, fileName: string, line: number) {
  return `[${text}](/${config.github.commonParams.owner}/${config.github.commonParams.repo}/blob/${sourceVersion.replace('\n', '')}/${fileName}#L${line})`;
}

function createRowFromMetric(metric: Metric, a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>, formatOptions?: FormatOptions) {
  return createRow(metric.columnName, a, b, metric.getValue, { ...metric.formatOptions, ...formatOptions });
}

function createRow(
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
    typeof percentDiff === 'number' ? formatDiff(percentDiff, formatOptions.precision) : '',
  ];
}

function indent(text: string, level: number) {
  return '&nbsp;'.repeat(2 * level) + text;
}

function formatDiff(percentDiff: number, precision?: number) {
  const percentString = `${percentDiff > 0 ? '+' : ''}${format(percentDiff * 100, precision)}%`;
  if (percentDiff > config.comparison.percentDiffSevereThreshold) {
    return `**${percentString}** 🚨`;
  }
  if (percentDiff > config.comparison.percentDiffWarningThreshold) {
    return `**${percentString}** 🔸`;
  }
  if (percentDiff < config.comparison.percentDiffGoldStarThreshold) {
    return `**${percentString}** 🌟`;
  }
  return percentString;
}

function format(x: string | number | undefined, precision = 1): string {
  switch (typeof x) {
    case 'string': return x;
    case 'number': return isNaN(x) ? 'N/A' : x.toFixed(precision);
    default: return '';
  }
}
