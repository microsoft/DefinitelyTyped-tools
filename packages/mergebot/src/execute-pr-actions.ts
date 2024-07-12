import { LabelName, labelNames } from "./basic";
import { MutationOptions } from "@apollo/client/core";
import * as schema from "@octokit/graphql-schema/schema";
import { PR_repository_pullRequest } from "./queries/schema/PR";
import { Actions } from "./compute-pr-actions";
import { createMutation, client } from "./graphql-client";
import { getProjectBoardColumns, getLabels } from "./util/cachedQueries";
import { noNullish, flatten } from "./util/util";
import { tagsToDeleteIfNotPosted } from "./comments";
import * as comment from "./util/comment";
import { request } from "https";
import { assertDefined } from "@definitelytyped/utils";

// https://github.com/orgs/DefinitelyTyped/projects/1
const projectBoardNumber = 1;
/**
 * The id for the project board, saved statically for inserting new cards.
 * you can query this with `projectV2(number: 1) { id }`
 */
const projectIdStatic = "PVT_kwDOADeBNM4AkH1q";
/**
 * The id for the Status field, which controls the column that the card appears in.
 * This is the statically saved ID, used as a fallback if the field id isn't found dynamically.
 */
const fieldIdStatic = "PVTSSF_lADOADeBNM4AkH1qzgcYOEM";

export async function executePrActions(
  actions: Actions,
  pr: PR_repository_pullRequest,
  dry?: boolean,
  projectOnly?: boolean,
) {
  const botComments: ParsedComment[] = getBotComments(pr);
  const mutations = noNullish(
    projectOnly
      ? await getMutationsForProjectChanges(actions, pr)
      : [
          // the mutations are ordered for presentation in the timeline:
          // * welcome comment is always first
          // * then labels, as a short "here's what I noticed"
          // * column changes after that (follow the labels since this is the consequence)
          // * state changes next, similar to column changes
          // * finally, any other comments (better to see label changes and then a comment that explains what happens now)
          ...getMutationsForComments(actions, pr.id, botComments, true),
          ...(await getMutationsForLabels(actions, pr)),
          ...(await getMutationsForProjectChanges(actions, pr)),
          ...getMutationsForCommentRemovals(actions, botComments),
          ...getMutationsForChangingPRState(actions, pr),
          ...getMutationsForComments(actions, pr.id, botComments, false),
        ],
  );
  const restCalls = getMutationsForReRunningCI(actions);
  if (!dry) {
    // Perform mutations one at a time, passing in the result of the previous mutation to the next
    let last: schema.Mutation = {};
    for (const mutation of mutations) {
      if (typeof mutation === "function") last = (await client.mutate(mutation(last))).data ?? {};
      else
        last =
          (await client.mutate(mutation as MutationOptions<schema.Mutation, { input: schema.AddCommentInput }>)).data ??
          {};
    }
    for (const restCall of restCalls) await doRestCall(restCall);
    return [...mutations, ...restCalls];
  } else {
    return [
      ...mutations.map((m) =>
        typeof m === "function"
          ? m({
              addProjectV2ItemById: {
                item: {
                  id: "TEST",
                } as any,
              },
            })
          : m,
      ),
      ...restCalls,
    ];
  }
}

async function getMutationsForLabels(actions: Actions, pr: PR_repository_pullRequest) {
  if (!actions.shouldUpdateLabels) return [];
  const labels = noNullish(pr.labels?.nodes).map((l) => l.name);
  const makeMutations = async (pred: (l: LabelName) => boolean, query: keyof schema.Mutation) => {
    const labels = labelNames.filter(pred);
    return labels.length === 0
      ? null
      : createMutation<schema.AddLabelsToLabelableInput & schema.RemoveLabelsFromLabelableInput>(query, {
          labelIds: await Promise.all(labels.map((label) => getLabelIdByName(label))),
          labelableId: pr.id,
        });
  };
  return Promise.all([
    makeMutations((label) => !labels.includes(label) && actions.labels.includes(label), "addLabelsToLabelable"),
    makeMutations((label) => labels.includes(label) && !actions.labels.includes(label), "removeLabelsFromLabelable"),
  ]);
}

async function getMutationsForProjectChanges(actions: Actions, pr: PR_repository_pullRequest) {
  if (!actions.projectColumn) return [];
  const card = pr.projectItems.nodes?.find((card) => card?.project.number === projectBoardNumber);
  const columnName =
    card?.fieldValueByName?.__typename === "ProjectV2ItemFieldSingleSelectValue" && card.fieldValueByName.name;
  if (actions.projectColumn === "*REMOVE*") {
    if (!card || columnName === "Recently Merged") {
      return [];
    } else {
      return [
        createMutation<schema.DeleteProjectV2ItemInput>("deleteProjectV2Item", {
          itemId: card.id,
          projectId: card.project.id,
        }),
      ];
    }
  }
  // Existing card is ok => do nothing
  if (columnName === actions.projectColumn) return [];
  const columns = await getProjectBoardColumns();
  const projectId = card ? card.project.id : projectIdStatic;
  const fieldId =
    card?.fieldValueByName?.__typename === "ProjectV2ItemFieldSingleSelectValue" &&
    card.fieldValueByName.field.__typename === "ProjectV2SingleSelectField"
      ? card.fieldValueByName.field.id
      : fieldIdStatic;
  if (!card) {
    return [
      createMutation<schema.AddProjectV2ItemByIdInput>(
        "addProjectV2ItemById",
        {
          contentId: pr.id,
          projectId,
        },
        "item { id }",
      ),
      (prev: schema.Mutation) =>
        createMutation<schema.UpdateProjectV2ItemFieldValueInput>("updateProjectV2ItemFieldValue", {
          itemId: prev.addProjectV2ItemById?.item?.id!,
          projectId,
          fieldId,
          value: { singleSelectOptionId: assertDefined(columns.get(actions.projectColumn!)) },
        }),
    ];
  } else {
    return [
      createMutation<schema.UpdateProjectV2ItemFieldValueInput>("updateProjectV2ItemFieldValue", {
        itemId: card.id,
        projectId,
        fieldId,
        value: { singleSelectOptionId: assertDefined(columns.get(actions.projectColumn!)) },
      }),
    ];
  }
}

interface ParsedComment {
  id: string;
  body: string;
  tag: string;
  status: string;
}

function getBotComments(pr: PR_repository_pullRequest): ParsedComment[] {
  return noNullish(
    (pr.comments.nodes ?? [])
      .filter((comment) => comment?.author?.login === "typescript-bot")
      .map((c) => {
        const { id, body } = c!,
          parsed = comment.parse(body);
        return parsed && { id, body, ...parsed };
      }),
  );
}

function getMutationsForComments(actions: Actions, prId: string, botComments: ParsedComment[], onlyWelcome: boolean) {
  return flatten(
    actions.responseComments.map((wantedComment) => {
      if ((wantedComment.tag === "welcome") !== onlyWelcome) return [];
      const sameTagComments = botComments.filter((comment) => comment.tag === wantedComment.tag);
      return sameTagComments.length === 0
        ? [
            createMutation<schema.AddCommentInput>("addComment", {
              subjectId: prId,
              body: comment.make(wantedComment),
            }),
          ]
        : sameTagComments.map((actualComment) =>
            actualComment.status === wantedComment.status
              ? null // Comment is up-to-date; skip
              : createMutation<schema.UpdateIssueCommentInput>("updateIssueComment", {
                  id: actualComment.id,
                  body: comment.make(wantedComment),
                }),
          );
    }),
  );
}

function getMutationsForCommentRemovals(actions: Actions, botComments: ParsedComment[]) {
  const ciTagToKeep = actions.responseComments.find((c) => c.tag.startsWith("ci-complaint"))?.tag;
  const postedTags = actions.responseComments.map((c) => c.tag);
  return botComments.map((comment) => {
    const { tag, id } = comment;
    const del = () => createMutation<schema.DeleteIssueCommentInput>("deleteIssueComment", { id });
    // Remove stale CI 'your build is green' notifications
    if (tag.includes("ci-") && tag !== ciTagToKeep) return del();
    // tags for comments that should be removed when not included in the actions
    if (tagsToDeleteIfNotPosted.includes(tag) && !postedTags.includes(tag)) return del();
    return null;
  });
}

function getMutationsForChangingPRState(actions: Actions, pr: PR_repository_pullRequest) {
  return [
    actions.shouldMerge
      ? createMutation<schema.MergePullRequestInput>("mergePullRequest", {
          commitHeadline: `🤖 Merge PR #${pr.number} ${pr.title} by @${pr.author?.login ?? "(ghost)"}`,
          expectedHeadOid: pr.headRefOid,
          mergeMethod: "SQUASH",
          pullRequestId: pr.id,
        })
      : null,
    actions.shouldClose
      ? createMutation<schema.ClosePullRequestInput>("closePullRequest", { pullRequestId: pr.id })
      : null,
  ];
}

async function getLabelIdByName(name: string): Promise<string> {
  const labels = await getLabels();
  const res = labels.find((l) => l.name === name)?.id;
  if (!res) throw new Error(`No label named "${name}" exists`);
  return res;
}

// *** HACK ***
// A GQL mutation of `rerequestCheckSuite` throws an error that it's only
// allowed from a GH app, but a `rerequest` rest call works fine.  So do a rest
// call for now, and hopefully GH will have a better way of handling these
// first-time contributors.  This whole mess should then turn to a GQL mutation,
// or better, be removed if there's some repo settings to allow test builds
// based on paths or something similar.

interface RestMutation {
  method: string;
  op: string;
}

function doRestCall(call: RestMutation): Promise<void> {
  const url = `https://api.github.com/repos/DefinitelyTyped/DefinitelyTyped/${call.op}`;
  const headers = {
    accept: "application/vnd.github.v3+json",
    authorization: `token ${process.env.BOT_AUTH_TOKEN}`,
    "user-agent": "mergebot",
  };
  return new Promise((resolve, reject) => {
    const req = request(url, { method: call.method, headers }, (reply) => {
      const bad = !reply.statusCode || reply.statusCode < 200 || reply.statusCode >= 300;
      if (bad) return reject(`doRestCall failed with a status of ${reply.statusCode}`);
      return resolve();
    });
    req.on("error", reject);
    req.end();
  });
}

function getMutationsForReRunningCI(actions: Actions) {
  return (actions.reRunActionsCheckSuiteIDs || []).map((id) => ({
    method: "POST",
    op: `check-suites/${id}/rerequest`,
  }));
}
