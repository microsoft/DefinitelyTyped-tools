import table from 'markdown-table';
import { PackageBenchmarkSummary, Document, config, compact } from '../common';
import { getOctokit } from './getOctokit';
import { assertDefined } from 'types-publisher/bin/util/util';
import { metrics, Metric } from './metrics';

export async function postComparisonResults(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  const prNumber = parseInt(assertDefined(
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
    `Required environment variable 'SYSTEM_PULLREQUEST_PULLREQUESTNUMBER' was not set.`), 10);

  const octokit = getOctokit();
  octokit.issues.createComment({
    ...config.github.commonParams,
    issue_number: prNumber,
    body: compact([
      `👋 **Hi there!** I’ve run some quick performance metrics against master and your PR. **This is still an experiment**, so don’t panic if I say something crazy! I’m still learning how to interpret these metrics. 😄`,
      ``,
      `Let’s review the numbers, shall we?`,
      ``,
      createTable(a, b, prNumber),
      ``,
      getSystemMismatchMessage(a, b),
      ``,
      getInterestingMetricsMessage(a, b),
      ``,
      'If you have any questions or comments about me, you can ping [`@andrewbranch`](https://github.com/andrewbranch). Have a nice day!'
    ]).join('\n'),
  });
}

function getSystemMismatchMessage(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  return a.system.hash !== b.system.hash
    ? `First off, note that the system varied slightly between these two runs, so you’ll have to take these measurements with a grain of salt.`
    : undefined;
}

function getInterestingMetricsMessage(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  const interestingMetrics = getInterestingMetrics(a, b);
  if (!interestingMetrics.length) {
    return `It looks like nothing changed _too_ much. I’m pretty lenient since I’m still an experiment, so take a look anyways and make sure nothing looks out of place.`;
  }
  if (interestingMetrics.every(({ isGood }) => isGood)) {
    return `Wow, it looks like all the big movers moved in the right direction! Way to go! 🌟`;
  }
  if (interestingMetrics.length > 3 && interestingMetrics.filter(({ isGood }) => isGood).length / interestingMetrics.length < 0.5) {
    return `It looks like there are several metrics that changed quite a bit. You might want to take a look and make sure your changes won’t cause painful slow-downs for users consuming these types.`;
  }
  return `Looks like there were a couple significant differences. You might want to take a look and make sure your changes won’t cause painful slow-downs for users consuming these types.`;
}

function getInterestingMetrics(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  return Object.values(metrics).reduce((acc: { metric: Metric, percentDiff: number, isGood: boolean }[], metric) => {
    if (metric.isUninteresting) {
      return acc;
    }
    const aValue = metric.getValue(a);
    const bValue = metric.getValue(b);
    const percentDiff = isNumber(aValue) && isNumber(bValue) && getPercentDiff(aValue, bValue);
    const comparisonValue = percentDiff && metric.higherIsBetter ? percentDiff * -1 : percentDiff;
    const isGood = comparisonValue < config.comparison.percentDiffGoldStarThreshold;
    if (percentDiff && comparisonValue && (comparisonValue > config.comparison.percentDiffWarningThreshold || isGood)) {
      return [
        ...acc,
        { metric, percentDiff, isGood },
      ];
    }
    return acc;
  }, []);
}

function createTable(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>, prNumber: number) {
  return table([
    ['', 'master', `#${prNumber}`, 'diff'],
    ['**Batch compilation**'],
    createRowFromMetric(metrics.typeCount, a, b),
    createRowFromMetric(metrics.assignabilityCacheSize, a, b),
    createRowFromMetric(metrics.subtypeCacheSize, a, b),
    createRowFromMetric(metrics.identityCacheSize, a, b),
    ['**Language service measurements**'],
    createRowFromMetric(metrics.samplesTaken, a, b),
    createRowFromMetric(metrics.identifierCount, a, b),
    ['`getCompletionsAtPosition`'], 
    createRowFromMetric(metrics.completionsMean, a, b),
    createRowFromMetric(metrics.completionsMedian, a, b),
    createRowFromMetric(metrics.completionsStdDev, a, b),
    createRowFromMetric(metrics.completionsWorstMean, a, b),
    createRow('Worst identifier', a, b, x => sourceLink(
      x.body.completions.worst.identifierText,
      x.body.sourceVersion,
      x.body.completions.worst.fileName,
      x.body.completions.worst.line)),
    ['`getQuickInfoAtPosition`'],
    createRowFromMetric(metrics.quickInfoMean, a, b),
    createRowFromMetric(metrics.quickInfoMedian, a, b),
    createRowFromMetric(metrics.quickInfoStdDev, a, b),
    createRowFromMetric(metrics.quickInfoWorstMean, a, b),
    createRow('Worst identifier', a, b, x => sourceLink(
      x.body.quickInfo.worst.identifierText,
      x.body.sourceVersion,
      x.body.quickInfo.worst.fileName,
      x.body.quickInfo.worst.line)),
    ['**System information**'],
    createRow('CPU count', a, b, x => x.system.cpus.length),
    createRow('CPU speed', a, b, x => `${x.system.cpus[0].speed / 100} GHz`),
    createRow('CPU model', a, b, x => x.system.cpus[0].model),
    createRow('CPU Architecture', a, b, x => x.system.arch),
    createRow('Memory', a, b, x => `${x.system.totalmem / 2 ** 30} GiB`),
    createRow('Platform', a, b, x => x.system.platform),
    createRow('Release', a, b, x => x.system.release),
  ]);
}

interface DiffOptions {
  noDiff?: boolean;
}

function sourceLink(text: string, sourceVersion: string, fileName: string, line: number) {
  return `[${text}](/${config.github.commonParams.owner}/${config.github.commonParams.repo}/blob/${sourceVersion}/${fileName}#L${line})`;
}

function createRowFromMetric(metric: Metric, a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  return createRow(metric.columnName, a, b, metric.getValue);
}

function createRow(
  title: string,
  a: Document<PackageBenchmarkSummary>,
  b: Document<PackageBenchmarkSummary>,
  getValue: (x: Document<PackageBenchmarkSummary>) => number | string | undefined,
  diffOptions: DiffOptions = {},
) {
  const aValue = getValue(a);
  const bValue = getValue(b);
  const percentDiff = !diffOptions.noDiff && typeof aValue === 'number' && typeof bValue === 'number' && !isNaN(bValue) && !isNaN(bValue)
    ? getPercentDiff(aValue, bValue)
    : undefined;
  
  return [
    `**${title}**`,
    format(aValue),
    format(bValue),
    typeof percentDiff === 'number' ? formatDiff(percentDiff) : '',
  ];
}

function isNumber(n: any): n is number {
  return typeof n === 'number' && !isNaN(n);
}

function getPercentDiff(original: number, updated: number) {
  return (updated - original) / original;
}

function formatDiff(percentDiff: number) {
  const percentString = `${percentDiff > 0 ? '+' : ''}${percentDiff * 100}%`;
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

function format(x: string | number | undefined): string {
  switch (typeof x) {
    case 'string': return x;
    case 'number': return isNaN(x) ? 'N/A' : x.toPrecision(3);
    default: return '';
  }
}
