import table from 'markdown-table';
import { PackageBenchmarkSummary, config } from '../common';
import { getOctokit } from './getOctokit';
import { assertDefined } from 'types-publisher/bin/util/util';

export async function postComparisonResults(a: PackageBenchmarkSummary, b: PackageBenchmarkSummary) {
  const prNumber = parseInt(assertDefined(
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
    `Required environment variable 'SYSTEM_PULLREQUEST_PULLREQUESTNUMBER' was not set.`), 10);

  const octokit = getOctokit();
  octokit.issues.createComment({
    ...config.github.commonParams,
    issue_number: prNumber,
    body: '',
  });
}
