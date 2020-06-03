import { PackageBenchmarkSummary, Document, toPackageKey } from "../common";
import { createComparisonTable } from "./createTable";

type BeforeAndAfter = [Document<PackageBenchmarkSummary>, Document<PackageBenchmarkSummary>];

export interface PostTypeScriptComparisonResultsOptions {
  comparisons: BeforeAndAfter[];
  dryRun: boolean;
}

export async function postTypeScriptComparisonResults({ comparisons }: PostTypeScriptComparisonResultsOptions) {
  return comparisons
    .map(([baseline, head]) =>
      [
        `### ${toPackageKey(baseline.body.packageName, baseline.body.packageVersion)}`,
        createComparisonTable(baseline, head, baseline.body.typeScriptVersion, "HEAD")
      ].join("\n")
    )
    .join("\n\n");
}
