import { PackageBenchmarkSummary, Document, config, compact } from '../common';
import { assertDefined } from 'types-publisher/bin/util/util';
import { getOctokit } from './getOctokit';
import { createTablesWithAnalysesMessage } from './createTablesWithAnalysesMessage';

type BeforeAndAfter = [Document<PackageBenchmarkSummary>, Document<PackageBenchmarkSummary>];

export async function postDependentsComparisonResult(comparisons: BeforeAndAfter[]) {
  const prNumber = parseInt(assertDefined(
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
    `Required environment variable 'SYSTEM_PULLREQUEST_PULLREQUESTNUMBER' was not set.`), 10);

  const octokit = getOctokit();
  return octokit.issues.createComment({
    ...config.github.commonParams,
    issue_number: prNumber,
    body: compact([
      `Ok, I’m back! As promised, here are the results from dependent packages`,
      ``,
      createTablesWithAnalysesMessage(comparisons, prNumber),
    ]).join('\n'),
  });
}

