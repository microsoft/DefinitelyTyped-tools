import { PackageBenchmarkSummary, config, compact, findLast } from "../common";
import { getOctokit } from "./getOctokit";
import { createTablesWithAnalysesMessage } from "./createTablesWithAnalysesMessage";
import { isPerfComment, createPerfCommentBody, getCommentData, CommentData } from "./comment";
import { OverallChange, getOverallChangeForComparisons } from "../analysis";
import { setLabels } from "./setLabels";
import { assertDefined } from "@definitelytyped/utils";

type BeforeAndAfter = [PackageBenchmarkSummary, PackageBenchmarkSummary];

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
  let message;
  if (dryRun) {
    return getFullFirstPostMessage(
      createTablesWithAnalysesMessage(comparisons, parseInt(process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER || "")),
      dependentCount
    );
  } else {
    try {
      const prNumber = parseInt(
        assertDefined(
          process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
          `Required environment variable 'SYSTEM_PULLREQUEST_PULLREQUESTNUMBER' was not set.`
        ),
        10
      );

      const octokit = getOctokit();
      const comments = await octokit.issues.listComments({
        ...config.github.commonParams,
        issue_number: prNumber,
      });

      const currentOverallChange = getOverallChangeForComparisons(comparisons);
      const mostRecentComment = findLast(comments.data, isPerfComment);
      const commentData: CommentData = {
        overallChange: currentOverallChange,
      };
      if (mostRecentComment) {
        const lastOverallChange = getCommentData(mostRecentComment)?.overallChange;

        if (currentOverallChange === lastOverallChange && !((currentOverallChange ?? 0) & OverallChange.Worse)) {
          // Everything is fine and nothing has changed, just chill
          return;
        }

        message = getConciseUpdateMessage(
          lastOverallChange,
          currentOverallChange,
          createTablesWithAnalysesMessage(
            comparisons,
            prNumber,
            /*alwaysWriteHeader*/ false,
            /*alwaysCollapseDetails*/ true
          ),
          comparisons[0][1].sourceVersion
        );

        await octokit.issues.createComment({
          ...config.github.commonParams,
          issue_number: prNumber,
          body: createPerfCommentBody(commentData, message),
        });
      } else {
        message = getFullFirstPostMessage(createTablesWithAnalysesMessage(comparisons, prNumber), dependentCount);
        await octokit.issues.createComment({
          ...config.github.commonParams,
          issue_number: prNumber,
          body: createPerfCommentBody(commentData, message),
        });
      }

      await setLabels(prNumber, currentOverallChange);
    } catch (err) {
      throw err;
    }
  }
  return message;
}

function getFullFirstPostMessage(mainMessage: string, dependentCount: number): string {
  return compact([
    `👋 **Hi there!** I’ve run some quick measurements against master and your PR. These metrics should help the humans reviewing this PR gauge whether it might negatively affect compile times or editor responsiveness for users who install these typings.`,
    ``,
    getDependentsMessage(dependentCount),
    ``,
    `Let’s review the numbers, shall we?`,
    ``,
    mainMessage,
  ]).join("\n");
}

function getConciseUpdateMessage(
  prevOverallChange: OverallChange | undefined,
  overallChange: OverallChange | undefined,
  mainMessage: string,
  sha: string
): string {
  const gotBetter = (prevOverallChange ?? 0) & OverallChange.Worse && !((overallChange ?? 0) & OverallChange.Worse);
  return [
    `Updated numbers for you here from ${sha.slice(0, 7)}. ${gotBetter ? "Nice job, these numbers look better." : ""}`,
    ``,
    mainMessage,
  ].join("\n");
}

function getDependentsMessage(dependentCount: number): string | undefined {
  if (dependentCount) {
    return `I’m still measuring **${dependentCount} other package${dependentCount === 1 ? "" : "s"}** that depend${
      dependentCount === 1 ? "s" : ""
    } on these typings, and will post another comment with those results when I’m done. But in the meantime, you can go ahead and see the results of what you directly changed in this PR.`;
  }
  return;
}
