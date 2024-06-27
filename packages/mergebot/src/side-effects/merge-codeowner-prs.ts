import * as schema from "@octokit/graphql-schema/schema";
import { CheckSuiteEvent } from "@octokit/webhooks-types";
import { createMutation, client } from "../graphql-client";

export const mergeCodeOwnersOnGreen = async (payload: CheckSuiteEvent) => {
    // Because we only care about GH actions, we can use the check suite API which means we get both the
    // commit and the PR, making it much less effort than other merge-on-greens
    // https://github.com/microsoft/TypeScript-repos-automation/blob/40ae8b3db63fd0150938e82e47dcb63ce65f7a2d/src/checks/mergeOnGreen.ts#L1

    if (payload.action === "completed"
        && payload.check_suite.conclusion === "success"
        && payload.check_suite.head_commit.author.name === "TS Bot"
        && payload.check_suite.head_commit.message === "Update CODEOWNERS"
        && payload.check_suite.pull_requests[0]!.base.repo.id === payload.check_suite.pull_requests[0]!.head.repo.id) {
        await client.mutate(createMutation<schema.MergePullRequestInput>("mergePullRequest", {
            commitHeadline: `🤖 Auto Merge`,
            expectedHeadOid: payload.check_suite.head_commit.id,
            mergeMethod: "SQUASH",
            pullRequestId: payload.check_suite.pull_requests[0]!.id.toFixed(),
        }));
    }

};
