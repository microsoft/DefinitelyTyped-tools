import { PackageBenchmarkSummary, Document, config, compact, systemsAreCloseEnough, getPercentDiff } from '../common';
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