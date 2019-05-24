import { createTable } from './createTable';
import { PackageBenchmarkSummary, systemsAreCloseEnough, getPercentDiff, config, Document, compact } from '../common';
import { metrics, Metric } from './metrics';

export function createTablesWithAnalysesMessage(pairs: [Document<PackageBenchmarkSummary>, Document<PackageBenchmarkSummary>][], prNumber: number, alwaysWriteHeading = false) {
  return pairs.map(([before, after]) => compact([
    pairs.length > 1 || alwaysWriteHeading ? `### ${before.body.packageName}/v${before.body.packageVersion}` : undefined,
    ``,
    createTable(before, after, prNumber),
    ``,
    getSystemMismatchMessage(before, after),
    ``,
    getInterestingMetricsMessage(before, after),
  ]).join('\n')).join('\n\n');
}

function getSystemMismatchMessage(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  return !systemsAreCloseEnough(a.system, b.system)
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

function isNumber(n: any): n is number {
  return typeof n === 'number' && !isNaN(n);
}
