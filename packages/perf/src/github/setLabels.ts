import { getOctokit } from './getOctokit';
import { OverallChange } from '../analysis';
import { config } from '../common';
import Octokit = require('@octokit/rest');

const perfLabels = ['Perf: Same', 'Perf: Better', 'Perf: Mixed', 'Perf: Worse'];

function isPerfLabel(label: Octokit.IssuesListLabelsOnIssueResponseItem) {
  return perfLabels.includes(label.name);
}

function toLabel(change: OverallChange | undefined): string | undefined {
  switch (change) {
    case OverallChange.Same: return perfLabels[0];
    case OverallChange.Better: return perfLabels[1];
    case OverallChange.Mixed: return perfLabels[2];
    case OverallChange.Worse: return perfLabels[3];
  }
}

export async function setLabels(prNumber: number, overallChange: OverallChange | undefined) {
  const octokit = getOctokit();
  const labels = await octokit.issues.listLabelsOnIssue({
    ...config.github.commonParams,
    issue_number: prNumber,
  });

  const perfLabels = labels.data.filter(isPerfLabel);
  const newLabel = toLabel(overallChange);
  const labelsToRemove = perfLabels.filter(l => l.name !== newLabel);
  const labelToAdd = perfLabels.some(l => l.name === newLabel) ? undefined : newLabel;

  for (const label of labelsToRemove) {
    await octokit.issues.removeLabel({
      ...config.github.commonParams,
      issue_number: prNumber,
      name: label.name,
    });
  }

  if (labelToAdd) {
    await octokit.issues.addLabels({
      ...config.github.commonParams,
      issue_number: prNumber,
      labels: [labelToAdd]
    });
  }
}
