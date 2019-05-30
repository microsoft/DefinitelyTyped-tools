import { createComparisonTable, createSingleRunTable } from './createTable';
import { PackageBenchmarkSummary, systemsAreCloseEnough, getPercentDiff, config, Document, compact } from '../common';
import { metrics, Metric } from './metrics';

export function createTablesWithAnalysesMessage(pairs: [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>][], prNumber: number, alwaysWriteHeading = false) {
  return pairs.map(([before, after]) => compact([
    pairs.length > 1 || alwaysWriteHeading ? `### ${after.body.packageName}/v${after.body.packageVersion}` : undefined,
    getIntroMessage(before, after),
    ``,
    before
      ? createComparisonTable(before, after, getBeforeTitle(before, after), getAfterTitle(before, after, prNumber))
      : createSingleRunTable(after),
    ``,
    before && getSystemMismatchMessage(before, after),
    ``,
    before && getInterestingMetricsMessage(before, after),
  ]).join('\n')).join('\n\n');
}

function getBeforeTitle(before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>) {
  if (before.body.packageVersion === after.body.packageVersion) {
    return 'master';
  }
  return `${before.body.packageVersion}@master`;
}

function getAfterTitle(before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>, prNumber: number) {
  if (before.body.packageVersion === after.body.packageVersion) {
    return `#${prNumber}`;
  }
  return `${after.body.packageVersion} in #${prNumber}`;
}

function getIntroMessage(before: Document<PackageBenchmarkSummary> | undefined, after: Document<PackageBenchmarkSummary>) {
  if (before && before.body.packageVersion === after.body.packageVersion) {
    return;
  }
  if (before) {
    return `These typings are for a version of ${before.body.packageName} that doesn’t yet exist on master, so I’ve compared them with v${before.body.packageVersion}.`;
  }
  return `These typings are for a package that doesn’t yet exist on master, so I don’t have anything to compare against yet! In the future, I’ll be able to compare PRs to ${after.body.packageName} with its source on master.`;
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
    const percentDiff = isNumber(aValue) && isNumber(bValue) && getPercentDiff(bValue, aValue);
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
