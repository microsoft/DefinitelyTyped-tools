import { PackageBenchmarkSummary, Document, config, compact } from '../common';
import { getOctokit } from './getOctokit';
import { assertDefined } from 'types-publisher/bin/util/util';
import { createTablesWithAnalysesMessage } from './createTablesWithAnalysesMessage';

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
  const message = compact([
    `👋 **Hi there!** I’ve run some quick performance metrics against master and your PR. **This is still an experiment**, so don’t panic if I say something crazy! I’m still learning how to interpret these metrics. 😄`,
    ``,
    getDependentsMessage(dependentCount),
    ``,
    `Let’s review the numbers, shall we?`,
    ``,
    createTablesWithAnalysesMessage(
      comparisons,
      parseInt(process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER || '')),
    ``,
    `---`,
    'If you have any questions or comments about me, you can ping [`@andrewbranch`](https://github.com/andrewbranch). Have a nice day!',
  ]).join('\n');

  if (!dryRun) {
    try {
      const prNumber = parseInt(assertDefined(
        process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
        `Required environment variable 'SYSTEM_PULLREQUEST_PULLREQUESTNUMBER' was not set.`), 10);

      const octokit = getOctokit();
      await octokit.issues.createComment({
        ...config.github.commonParams,
        issue_number: prNumber,
        body: message,
      });
    } catch (err) {
      console.log(message);
      throw err;
    }
  }
  return message;
}

function getDependentsMessage(dependentCount: number): string | undefined {
  if (dependentCount) {
    return `I’m still measuring **${dependentCount} other package${dependentCount === 1 ? '' : 's'}** that depend${dependentCount === 1 ? 's' : ''} on these typings, and will post another comment with those results when I’m done. But in the meantime, you can go ahead and see the results of what you directly changed in this PR.`;
  }
}
