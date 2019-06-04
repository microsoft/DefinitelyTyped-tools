import { createComparisonTable, createSingleRunTable } from './createTable';
import { PackageBenchmarkSummary, systemsAreCloseEnough, Document, compact, toPackageKey } from '../common';
import { getInterestingMetrics, SignificanceLevel, ComparedMetric } from '../analysis';

export function createTablesWithAnalysesMessage(pairs: [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>][], prNumber: number, alwaysWriteHeading = false, alwaysCollapseDetails = false) {
  return pairs.map(([before, after]) => {
    const interestingMetrics = before && getInterestingMetrics(before, after);
    const shouldCollapseDetails = alwaysCollapseDetails || !interestingMetrics || !interestingMetrics.length;
    const messageBody = [
      before
        ? createComparisonTable(before, after, getBeforeTitle(before, after), getAfterTitle(before, after, prNumber))
        : createSingleRunTable(after),
      ``,
      before && getSystemMismatchMessage(before, after),
    ].join('\n');

    return compact([
      pairs.length > 1 || alwaysWriteHeading ? `### ${after.body.packageName}/v${after.body.packageVersion}` : undefined,
      getIntroMessage(before, after),
      ``,
      getLanguageServiceCrashMessage(after),
      ``,
      shouldCollapseDetails ? details(messageBody, getDetailsSummaryTitle(pairs.length, after)) : messageBody,
      ``,
      interestingMetrics && getInterestingMetricsMessage(interestingMetrics),
    ]).join('\n');
  }).join('\n\n');
}

function getDetailsSummaryTitle(comparisonsCount: number, benchmark: Document<PackageBenchmarkSummary>) {
  let titleStart = '<strong>Comparison details';
  if (comparisonsCount > 1) {
    titleStart += ` for ${toPackageKey(benchmark.body.packageName, benchmark.body.packageVersion)}`;
  }
  return titleStart + '</strong> 📊';
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

function getLanguageServiceCrashMessage(benchmark: Document<PackageBenchmarkSummary>) {
  if (benchmark.body.languageServiceCrashed) {
    return `Before we get into it, I need to mention that **the language service crashed** while taking these measurements. ` +
      `This isn’t your fault—on the contrary, you helped us find a probably TypeScript bug! But, be aware that these results ` +
      `may or may not be quite what they should be, depending on how many locations in your tests caused a crash. Paging ` +
      `@andrewbranch to investigate.`;
  }
}

function getSystemMismatchMessage(a: Document<PackageBenchmarkSummary>, b: Document<PackageBenchmarkSummary>) {
  return !systemsAreCloseEnough(a.system, b.system)
    ? `First off, note that the system varied slightly between these two runs, so you’ll have to take these measurements with a grain of salt.`
    : undefined;
}

function getInterestingMetricsMessage(interestingMetrics: readonly ComparedMetric[]) {
  if (!interestingMetrics.length) {
    return `It looks like nothing changed too much. I’m pretty lenient since I’m still an experiment, so take a look anyways and make sure nothing looks out of place.`;
  }
  const awesomeMetrics = interestingMetrics.filter(({ significance }) => significance === SignificanceLevel.Awesome);
  if (interestingMetrics.length === awesomeMetrics.length) {
    return `Wow, it looks like all the big movers moved in the right direction! Way to go! 🌟`;
  }
  if (interestingMetrics.length > 3 && awesomeMetrics.length / interestingMetrics.length < 0.5) {
    return 'It looks like there are several metrics that changed quite a bit. You might want to take a look and make sure your changes won’t cause slow-downs for users consuming these types.';
  }
  const metricsToCheck = interestingMetrics.filter(({ significance }) => significance === SignificanceLevel.Warning || significance === SignificanceLevel.Alert);
  return `Looks like there were a couple significant differences—take a look at `
    + formatListForSentence(metricsToCheck.map(m => `**${m.metric.sentenceName}**`))
    + ` to make sure everything looks ok.`;
}

function details(details: string, summary?: string) {
  return compact([
    '<details>',
    summary && `<summary>${summary}</summary>`,
    '',
    details,
    `</details>`
  ]).join('\n');
}

function formatListForSentence(items: string[]) {
  return items.map((item, index) => {
    const isFirst = index === 0;
    const isLast = index === items.length - 1;
    return !isFirst && isLast ? `and ${item}` : item;
  }).join(items.length > 2 ? ', ' : ' ');
}
