import { compact, PackageBenchmarkSummary, Document, toPackageKey } from "../common";
import { createTable } from "./createTable";

type BeforeAndAfter = [Document<PackageBenchmarkSummary>, Document<PackageBenchmarkSummary>];

export interface PostTypeScriptComparisonResultsOptions {
  comparisons: BeforeAndAfter[];
  dryRun: boolean;
}

export async function postTypeScriptComparisonResults({
  comparisons,
}: PostTypeScriptComparisonResultsOptions) {
  const message = comparisons.map(([baseline, head]) => [
    `### ${toPackageKey(baseline.body.packageName, baseline.body.packageVersion)}`,
    createTable(baseline, head, baseline.body.typeScriptVersion, 'HEAD'),
  ].join('\n')).join('\n\n');

  return message;
}
