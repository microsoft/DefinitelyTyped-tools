import { PackageBenchmarkSummary, Document, config, compact, findLast } from '../common';
import { getOctokit } from './getOctokit';
import { assertDefined } from 'types-publisher/bin/util/util';
import { createTablesWithAnalysesMessage } from './createTablesWithAnalysesMessage';
import { isPerfComment, createPerfCommentBody, getCommentData } from './comment';
import { getOverallChange, OverallChange } from '../analysis';
import { setLabels } from './setLabels';

type BeforeAndAfter = [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>];

export interface PostInitialComparisonResultsOptions {
  comparisons: BeforeAndAfter[];
  dependentCount: number;
  dryRun: boolean;
}

export async function postInitialComparisonResults({
  comparisons,
  dependentCount,
  dryRun,
}: PostInitialComparisonResultsOptions) {

  if (dryRun) {
    return getFullFirstPostMessage(
      createTablesWithAnalysesMessage(
        comparisons,
        parseInt(process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER || '')),
      dependentCount);
  } else {
    try {
      const prNumber = parseInt(assertDefined(
        process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
        `Required environment variable 'SYSTEM_PULLREQUEST_PULLREQUESTNUMBER' was not set.`), 10);

      const octokit = getOctokit();
      const comments = await octokit.issues.listComments({
        ...config.github.commonParams,
        issue_number: prNumber,
      });

      let currentOverallChange = OverallChange.Same;
      for (const comparison of comparisons) {
        currentOverallChange |= comparison[0] ? getOverallChange(comparison[0], comparison[1]) : OverallChange.Same;
      }

      const mostRecentComment = findLast(comments.data, isPerfComment);
      if (mostRecentComment) {
        const lastOverallChange = getCommentData(mostRecentComment)?.overallChange;

        if (currentOverallChange === lastOverallChange && !(currentOverallChange & OverallChange.Worse)) {
          // Everything is fine and nothing has changed, just chill
          return;
        }

        const message = getConciseUpdateMessage(
          lastOverallChange,
          currentOverallChange,
          createTablesWithAnalysesMessage(comparisons, prNumber, /*alwaysWriteHeader*/ false, /*alwaysCollapseDetails*/ true),
          comparisons[0][1].body.sourceVersion);

        await octokit.issues.createComment({
          ...config.github.commonParams,
          issue_number: prNumber,
          body: createPerfCommentBody({ overallChange: currentOverallChange }, message),
        });
      } else {
        const message = getFullFirstPostMessage(createTablesWithAnalysesMessage(comparisons, prNumber), dependentCount);
        await octokit.issues.createComment({
          ...config.github.commonParams,
          issue_number: prNumber,
          body: createPerfCommentBody({ overallChange: currentOverallChange }, message),
        });
      }

      await setLabels(prNumber, currentOverallChange);
    } catch (err) {
      throw err;
    }
  }
}

function getFullFirstPostMessage(mainMessage: string, dependentCount: number): string {
  return compact([
    `👋 **Hi there!** I’ve run some quick measurements against master and your PR. These metrics should help the humans reviewing this PR gauge whether it might negatively affect compile times or editor responsiveness for users who install these typings.`,
    ``,
    getDependentsMessage(dependentCount),
    ``,
    `Let’s review the numbers, shall we?`,
    ``,
    mainMessage
  ]).join('\n');
}

function getConciseUpdateMessage(
  prevOverallChange: OverallChange | undefined,
  overallChange: OverallChange,
  mainMessage: string,
  sha: string,
): string {
  const gotBetter = (prevOverallChange ?? 0) & OverallChange.Worse && !((overallChange ?? 0) & OverallChange.Worse);
  return [
    `Updated numbers for you here from ${sha.slice(0, 7)}. ${gotBetter ? 'Nice job, these numbers look better.' : ''}`,
    ``,
    mainMessage,
  ].join('\n');
}

function getDependentsMessage(dependentCount: number): string | undefined {
  if (dependentCount) {
    return `I’m still measuring **${dependentCount} other package${dependentCount === 1 ? '' : 's'}** that depend${dependentCount === 1 ? 's' : ''} on these typings, and will post another comment with those results when I’m done. But in the meantime, you can go ahead and see the results of what you directly changed in this PR.`;
  }
}
