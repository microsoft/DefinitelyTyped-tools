import { createComparisonTable, createSingleRunTable } from "./createTable";
import { PackageBenchmarkSummary, compact, toPackageKey, packageVersionsAreEqual } from "../common";
import { getInterestingMetrics, SignificanceLevel, ComparedMetric } from "../analysis";

export function createTablesWithAnalysesMessage(
  pairs: [PackageBenchmarkSummary, PackageBenchmarkSummary][],
  prNumber: number,
  alwaysWriteHeading = false,
  alwaysCollapseDetails = false
) {
  return pairs
    .map(([before, after]) => {
      const interestingMetrics = before && getInterestingMetrics(before, after);
      const shouldCollapseDetails = alwaysCollapseDetails || !interestingMetrics || !interestingMetrics.length;
      const messageBody = [
        before
          ? createComparisonTable(before, after, getBeforeTitle(before, after), getAfterTitle(before, after, prNumber))
          : createSingleRunTable(after),
        ``
      ].join("\n");

      return compact([
        pairs.length > 1 || alwaysWriteHeading
          ? `### ${after.packageName}/v${after.packageVersionMajor}.${after.packageVersionMinor}`
          : undefined,
        getIntroMessage(before, after),
        ``,
        getLanguageServiceCrashMessage(after),
        ``,
        shouldCollapseDetails ? details(messageBody, getDetailsSummaryTitle(pairs.length, after)) : messageBody,
        ``,
        interestingMetrics && getInterestingMetricsMessage(interestingMetrics)
      ]).join("\n");
    })
    .join("\n\n");
}

function getDetailsSummaryTitle(comparisonsCount: number, benchmark: PackageBenchmarkSummary) {
  let titleStart = "<strong>Comparison details";
  if (comparisonsCount > 1) {
    titleStart += ` for ${toPackageKey(benchmark)}`;
  }
  return titleStart + "</strong> 📊";
}

function getBeforeTitle(before: PackageBenchmarkSummary, after: PackageBenchmarkSummary) {
  if (packageVersionsAreEqual(before, after)) {
    return "master";
  }
  return `${before.packageVersionMajor}.${before.packageVersionMinor}@master`;
}

function getAfterTitle(before: PackageBenchmarkSummary, after: PackageBenchmarkSummary, prNumber: number) {
  if (packageVersionsAreEqual(before, after)) {
    return `#${prNumber}`;
  }
  return `${after.packageVersionMajor}.${after.packageVersionMinor} in #${prNumber}`;
}

function getIntroMessage(before: PackageBenchmarkSummary | undefined, after: PackageBenchmarkSummary) {
  if (before && packageVersionsAreEqual(before, after)) {
    return;
  }
  if (before) {
    return `These typings are for a version of ${before.packageName} that doesn’t yet exist on master, so I’ve compared them with v${before.packageVersionMajor}.${before.packageVersionMinor}.`;
  }
  return `These typings are for a package that doesn’t yet exist on master, so I don’t have anything to compare against yet! In the future, I’ll be able to compare PRs to ${after.packageName} with its source on master.`;
}

function getLanguageServiceCrashMessage(benchmark: PackageBenchmarkSummary) {
  if (benchmark.languageServiceCrashed) {
    return (
      `Before we get into it, I need to mention that **the language service crashed** while taking these measurements. ` +
      `This isn’t your fault—on the contrary, you helped us find a probably TypeScript bug! But, be aware that these results ` +
      `may or may not be quite what they should be, depending on how many locations in your tests caused a crash. Paging ` +
      `@andrewbranch to investigate.`
    );
  }
  return;
}

function getInterestingMetricsMessage(interestingMetrics: readonly ComparedMetric[]) {
  if (!interestingMetrics.length) {
    return `It looks like nothing changed too much. I won’t post performance data again unless it gets worse.`;
  }
  const awesomeMetrics = interestingMetrics.filter(({ significance }) => significance === SignificanceLevel.Awesome);
  if (interestingMetrics.length === awesomeMetrics.length) {
    return `Wow, it looks like all the big movers moved in the right direction! Way to go! 🌟 I won’t post performance data again unless it gets worse.`;
  }
  if (interestingMetrics.length > 3 && awesomeMetrics.length / interestingMetrics.length < 0.5) {
    return "It looks like there are several metrics that changed quite a bit. You might want to take a look and make sure your changes won’t cause slow-downs for users consuming these types.";
  }
  const metricsToCheck = interestingMetrics.filter(
    ({ significance }) => significance === SignificanceLevel.Warning || significance === SignificanceLevel.Alert
  );
  return (
    `Looks like there were a couple significant differences—take a look at ` +
    formatListForSentence(metricsToCheck.map(m => `**${m.metric.sentenceName}**`)) +
    ` to make sure everything looks ok.`
  );
}

function details(details: string, summary?: string) {
  return compact(["<details>", summary && `<summary>${summary}</summary>`, "", details, `</details>`]).join("\n");
}

function formatListForSentence(items: string[]) {
  return items
    .map((item, index) => {
      const isFirst = index === 0;
      const isLast = index === items.length - 1;
      return !isFirst && isLast ? `and ${item}` : item;
    })
    .join(items.length > 2 ? ", " : " ");
}
