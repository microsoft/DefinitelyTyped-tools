import { PackageBenchmarkSummary, Document, config, compact } from '../common';
import { getOctokit } from './getOctokit';
import { assertDefined } from 'types-publisher/bin/util/util';
import { createTablesWithAnalysesMessage } from './createTablesWithAnalysesMessage';
import { isPerfComment, createPerfCommentBody } from './comment';

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

      const hasPreviousComment = comments.data.some(isPerfComment);
      const message = hasPreviousComment
        ? getConciseUpdateMessage(
          createTablesWithAnalysesMessage(comparisons, prNumber, /*alwaysWriteHeader*/ false, /*alwaysCollapseDetails*/ true),
          comparisons[0][1].body.sourceVersion)
        : getFullFirstPostMessage(createTablesWithAnalysesMessage(comparisons, prNumber), dependentCount);

      await octokit.issues.createComment({
        ...config.github.commonParams,
        issue_number: prNumber,
        body: createPerfCommentBody(message),
      });
    } catch (err) {
      throw err;
    }
  }
}

function getFullFirstPostMessage(mainMessage: string, dependentCount: number): string {
  return compact([
    `👋 **Hi there!** I’ve run some quick performance metrics against master and your PR. **This is still an experiment**, so don’t panic if I say something crazy! I’m still learning how to interpret these metrics.`,
    ``,
    getDependentsMessage(dependentCount),
    ``,
    `Let’s review the numbers, shall we?`,
    ``,
    mainMessage,
    ``,
    `---`,
    'If you have any questions or comments about me, you can ping [`@andrewbranch`](https://github.com/andrewbranch). Have a nice day!',
  ]).join('\n');
}

function getConciseUpdateMessage(mainMessage: string, sha: string): string {
  return [
    `Updated numbers for you here from ${sha.slice(0, 7)}:`,
    ``,
    mainMessage,
  ].join('\n');
}

function getDependentsMessage(dependentCount: number): string | undefined {
  if (dependentCount) {
    return `I’m still measuring **${dependentCount} other package${dependentCount === 1 ? '' : 's'}** that depend${dependentCount === 1 ? 's' : ''} on these typings, and will post another comment with those results when I’m done. But in the meantime, you can go ahead and see the results of what you directly changed in this PR.`;
  }
}
