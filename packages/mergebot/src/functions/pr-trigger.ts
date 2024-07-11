// GH webhook entry point

import { getPRInfo } from "../queries/pr-query";
import { deriveStateForPR } from "../pr-info";
import { process as computeActions } from "../compute-pr-actions";
import { executePrActions } from "../execute-pr-actions";
import { mergeCodeOwnersOnGreen } from "../side-effects/merge-codeowner-prs";
import { runQueryToGetPRMetadataForSHA1 } from "../queries/SHA1-to-PR-query";
import { app, HttpRequest, InvocationContext } from "@azure/functions";
import { reply } from "../util/reply";
import { httpLog, shouldRunRequest } from "../util/verify";
import type {
  CheckSuiteEvent,
  IssueCommentEvent,
  ProjectsV2ItemEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
} from "@octokit/webhooks-types";
import { runQueryToGetPRForCardId } from "../queries/card-id-to-pr-query";

app.http("PR-Trigger", { methods: ["GET", "POST"], authLevel: "anonymous", handler: httpTrigger });
const eventNames = [
  "check_suite.completed",
  "issue_comment.created",
  "issue_comment.deleted",
  "issue_comment.edited",
  "projects_v2_item.edited",
  "pull_request.closed",
  "pull_request.edited",
  "pull_request.opened",
  "pull_request.ready_for_review",
  "pull_request.reopened",
  "pull_request.synchronize",
  "pull_request_review.dismissed",
  "pull_request_review.submitted",
] as const;
type PrEvent =
  | { name: "check_suite"; payload: CheckSuiteEvent }
  | { name: "issue_comment"; payload: IssueCommentEvent }
  | { name: "projects_v2_item"; payload: ProjectsV2ItemEvent }
  | { name: "pull_request"; payload: PullRequestEvent }
  | { name: "pull_request_review"; payload: PullRequestReviewEvent };

class IgnoredBecause {
  constructor(public reason: string) {}
}

async function httpTrigger(req: HttpRequest, context: InvocationContext) {
  const body = (await req.json()) as any;
  httpLog(context, req.headers, body);
  const evName = req.headers.get("x-github-event"),
    evAction = body.action;

  if (!(await shouldRunRequest(context, req.headers, body))) {
    return reply(context, 200, "Can't handle this request");
  }

  if (evName === "check_run" && evAction === "completed") {
    context.log(`>>>>>> name: ${body?.check_run?.name}, sha: ${body?.check_run?.head_sha}`);
    if (body?.check_run?.head_sha && body?.repository?.full_name === "DefinitelyTyped/DefinitelyTyped") {
      const pr = await runQueryToGetPRMetadataForSHA1("DefinitelyTyped", "DefinitelyTyped", body?.check_run?.head_sha);
      if (pr) {
        context.log(`>>>>>>>>> pr => num: ${pr.number}, title: "${pr.title}" closed: ${pr.closed}`);
      } else {
        context.log(`>>>>>>>>> pr => not found`);
      }
    }
  }
  if (eventNames.includes(`${evName}.${evAction}` as any)) {
    return handleTrigger(context, { name: evName as PrEvent["name"], payload: body });
  } else {
    return reply(context, 200, "Can't handle this request");
  }
}

const handleTrigger = async (context: InvocationContext, event: PrEvent) => {
  const fullName = event.name + "." + event.payload.action;
  context.log(`Handling event: ${fullName}`);
  if (event.payload.sender.login === "typescript-bot" && fullName !== "check_suite.completed")
    return reply(context, 200, "Skipped webhook because it was triggered by typescript-bot");

  // Allow the bot to run side-effects that are not the 'core' function
  // of the review cycle, but are related to keeping DT running smoothly
  if (event.name === "check_suite") await mergeCodeOwnersOnGreen(event.payload);

  const pr: { number: number; title?: string } | IgnoredBecause = await prFromEvent(event);
  if (pr instanceof IgnoredBecause) return reply(context, 200, `Ignored: ${pr.reason}`);

  // wait 30s to process a trigger; if a new trigger comes in for the same PR, it supersedes the old one
  if (await debounce(30000, pr.number))
    return reply(context, 200, `Skipped webhook, superseded by a newer one for ${pr.number}`);

  context.log(`Getting info for PR ${pr.number} - ${pr.title || "(title not fetched)"}`);
  const info = await getPRInfo(pr.number);
  const prInfo = info.data.repository?.pullRequest;

  // If it didn't work, bail early
  if (!prInfo) {
    if (event.name === "issue_comment") return reply(context, 200, `NOOPing due to ${pr.number} not being a PR`);
    else return reply(context, 422, `No PR with this number exists, (${JSON.stringify(info)})`);
  }

  // Convert the info to a set of actions for the bot
  const state = await deriveStateForPR(prInfo);
  const actions = computeActions(state);

  // Act on the actions
  await executePrActions(actions, prInfo);

  // We are responding real late in the process, so it might show
  // as a timeout in GH a few times (e.g. after GH/DT/NPM lookups)
  return {
    status: 200,
    body: JSON.stringify(actions),
  };
};

const prFromEvent = async (event: PrEvent) => {
  switch (event.name) {
    case "check_suite":
      return prFromCheckSuiteEvent(event.payload);
    case "issue_comment":
      return event.payload.issue;
    case "projects_v2_item":
      const pr = await runQueryToGetPRForCardId(event.payload.projects_v2_item.node_id);
      return pr
        ? { number: pr.number }
        : new IgnoredBecause(`Could not find PR for card_id: ${event.payload.projects_v2_item.node_id}`);
    case "pull_request":
      return event.payload.pull_request;
    case "pull_request_review":
      return event.payload.pull_request;
  }
};

const prFromCheckSuiteEvent = async (payload: CheckSuiteEvent) => {
  // There is an `payload.check_suite.pull_requests` but it looks like
  // it's only populated for PRs in the other direction: going from DT to
  // forks (mostly by a pull bot).  See also `IgnoredBecause` below.
  //
  // So find it with a gql query instead:
  // TLDR: it's not in the API, so do a search (used on Peril for >3 years)
  // (there is an `associatedPullRequests` on a commit object, but that
  // doesn't work for commits on forks)
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const sha = payload.check_suite.head_sha;
  const pr = await runQueryToGetPRMetadataForSHA1(owner, repo, sha);
  if (pr && !pr.closed) return pr;
  // no such PR, and we got related reverse PRs => just ignore it
  if (payload.check_suite.pull_requests.length > 0)
    return new IgnoredBecause(`No PRs for sha and ${payload.check_suite.pull_requests.length} reverse PRs (${sha})`);
  throw new Error(`PR Number not found: no ${!pr ? "PR" : "open PR"} for sha in status (${sha})`);
};

const waiters: Map<unknown, () => void> = new Map();
function debounce(delay: number, group: unknown) {
  waiters.get(group)?.(); // cancel older handler for the same pr, if one exists
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      waiters.delete(group);
      resolve(false);
    }, delay);
    waiters.set(group, () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}
