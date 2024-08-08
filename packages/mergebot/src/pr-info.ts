import { BlessedColumnName, ColumnName, columnNameToBlessed, isBlessedColumnName, PopularityLevel, projectBoardNumber } from "./basic";
import {
  PR_repository_pullRequest,
  PR_repository_pullRequest_commits_nodes_commit_checkSuites,
  PR_repository_pullRequest_timelineItems,
  PR_repository_pullRequest_comments_nodes,
  PR_repository_pullRequest_commits_nodes_commit_checkSuites_nodes,
} from "./queries/schema/PR";
import { getMonthlyDownloadCount } from "./util/npm";
import { fetchFile as defaultFetchFile } from "./util/fetchFile";
import { noNullish, someLast, sameUser, authorNotBot, max, abbrOid } from "./util/util";
import { fileLimit } from "./queries/pr-query";
import * as comment from "./util/comment";
import * as urls from "./urls";
import * as OldHeaderParser from "@definitelytyped/old-header-parser";
import * as jsonDiff from "fast-json-patch";
import { isDeepStrictEqual } from "util";
import { isDeclarationPath } from "@definitelytyped/utils";

const criticalPopularityThreshold = 5_000_000;
const normalPopularityThreshold = 200_000;

// Some error found, will be passed to `process` to report in a comment
interface BotError {
  readonly type: "error";
  readonly now: Date;
  readonly message: string;
  readonly author: string | undefined;
}

interface BotEnsureRemovedFromProject {
  readonly type: "remove";
  readonly now: Date;
  readonly message: string;
  readonly isDraft: boolean;
}

export interface PackageInfo {
  name: string | null; // null => not in a package (= infra files)
  kind: "edit" | "add" | "delete";
  files: FileInfo[];
  owners: string[]; // existing owners on master
  addedOwners: string[];
  deletedOwners: string[];
  popularityLevel: PopularityLevel;
  isSafeInfrastructureEdit?: boolean;
}

type FileKind = "test" | "definition" | "markdown" | "package-meta" | "package-meta-ok" | "infrastructure";

export interface FileInfo {
  path: string;
  kind: FileKind;
  suspect?: string; // reason for a file being "package-meta" rather than "package-meta-ok"
}

export type ReviewInfo = {
  type: string;
  reviewer: string;
  date: Date;
} & ({ type: "approved"; isMaintainer: boolean } | { type: "changereq" } | { type: "stale"; abbrOid: string });

export type CIResult = "unknown" | "pass" | "fail" | "missing" | "action_required";

export interface PrInfo {
  readonly type: "info";

  /** ISO8601 date string for the time the PR info was created at */
  readonly now: Date;

  readonly pr_number: number;

  /**
   * The head commit of this PR (full format)
   */
  readonly headCommitOid: string;

  /**
   * merge-base-like commit for config comparisons (see getBaseId() below)
   */
  readonly mergeBaseOid: string;

  /**
   * The GitHub login of the PR author
   */
  readonly author: string;

  /**
   * The CI status of the head commit
   */
  readonly ciResult: CIResult;

  /**
   * A link to the log for the failing CI if it exists
   */
  readonly ciUrl?: string;

  /**
   * An ID for a check suite that could need re-running
   */
  readonly reRunCheckSuiteIDs?: number[];

  /**
   * True if the PR has a merge conflict
   */
  readonly hasMergeConflict: boolean;

  /**
   * The date the latest commit was pushed to GitHub
   */
  readonly lastPushDate: Date;

  /**
   * The date of the last activity, including non-bot comments
   */
  readonly lastActivityDate: Date;

  /**
   * Name of column used if a maintainer blessed this PR
   */
  readonly maintainerBlessed?: BlessedColumnName;

  /**
   * The time we posted a merge offer, if any (required for merge request in addition to passing CI and a review)
   */
  readonly mergeOfferDate?: Date;

  /*
   * Time of a "ready to merge" request and the requestor
   */
  readonly mergeRequestDate?: Date;
  readonly mergeRequestUser?: string;

  readonly isFirstContribution: boolean;

  /*
   * True if there are more files than we can fetch from the initial query (or no files)
   */
  readonly tooManyFiles: boolean;
  /*
   * True for PRs with over 5k line changes (top ~3%)
   */
  readonly hugeChange: boolean;

  readonly popularityLevel: PopularityLevel;

  readonly pkgInfo: readonly PackageInfo[];

  readonly reviews: readonly ReviewInfo[];

  // The ID of the main comment so that it can be linked to by other comments
  readonly mainBotCommentID?: number;
}

export type BotResult = PrInfo | BotError | BotEnsureRemovedFromProject;

function getHeadCommit(pr: PR_repository_pullRequest) {
  return pr.commits.nodes?.find((c) => c?.commit.oid === pr.headRefOid)?.commit;
}
function getBaseId(pr: PR_repository_pullRequest): string | undefined {
  // Finds a revision to compare config files against (similar to git merge-base, but simple (linear
  // history on master, assume sane merges at most): finds the most recent sha1 that is not part of
  // the PR -- not too reliable, but better than always using "master").
  const nodes = pr.commitIds.nodes;
  if (!nodes) return;
  const prCommits = noNullish(nodes.map((node) => node?.commit.oid));
  if (!prCommits.length) return;
  for (const node of nodes.slice(0).reverse()) {
    const parents = node?.commit.parents.nodes;
    if (!parents) continue;
    for (const parent of parents) {
      if (parent?.oid && !prCommits.includes(parent.oid)) return parent.oid;
    }
  }
  return;
}

// The GQL response => Useful data for us
export async function deriveStateForPR(
  prInfo: PR_repository_pullRequest,
  fetchFile = defaultFetchFile,
  getDownloads = getMonthlyDownloadCount,
  now = new Date(),
): Promise<BotResult> {
  // eslint-disable-next-line eqeqeq
  if (prInfo.author == null) return botError("PR author does not exist");

  if (prInfo.isDraft) return botEnsureRemovedFromProject("PR is a draft");
  if (prInfo.state !== "OPEN") return botEnsureRemovedFromProject("PR is not active");

  const headCommit = getHeadCommit(prInfo);
  // eslint-disable-next-line eqeqeq
  if (headCommit == null) return botError("No head commit found");
  const baseId = getBaseId(prInfo) || "master";

  const author = prInfo.author.login;
  const isFirstContribution = prInfo.authorAssociation === "FIRST_TIME_CONTRIBUTOR";

  const createdDate = new Date(prInfo.createdAt);
  // apparently `headCommit.pushedDate` can be null in some cases (see #48708), use the PR creation time for that
  // (it would be bad to use `committedDate`/`authoredDate`, since these can be set to arbitrary values)
  const lastPushDate = new Date(headCommit.pushedDate || prInfo.createdAt);
  const lastCommentDate = getLastCommentishActivityDate(prInfo);
  const blessing = getLastMaintainerBlessing(lastPushDate, prInfo);
  const reopenedDate = getReopenedDate(prInfo.timelineItems);
  // we should generally have all files (except for draft PRs)
  const fileCount = prInfo.changedFiles;
  // we fetch all files so this shouldn't happen, but GH has a limit of 3k files even with
  // pagination (docs.github.com/en/rest/reference/pulls#list-pull-requests-files) and in
  // that case `files.totalCount` would be 3k so it'd fit the count but `changedFiles` would
  // be correct; so to be safe: check it, and warn if there are many files (or zero)
  const tooManyFiles =
    !fileCount || // should never happen, make it look fishy if it does
    fileCount > fileLimit || // suspiciously many files
    fileCount !== prInfo.files?.nodes?.length; // didn't get all files (probably too many)
  const hugeChange = prInfo.additions + prInfo.deletions > 5000;

  const paths = noNullish(prInfo.files?.nodes)
    .map((f) => f.path)
    .sort();
  if (paths.length > fileLimit) paths.length = fileLimit; // redundant, but just in case
  const pkgInfoEtc = await getPackageInfosEtc(paths, prInfo.headRefOid, baseId, fetchFile, async (name) =>
    getDownloads(name, lastPushDate),
  );
  if (pkgInfoEtc instanceof Error) return botError(pkgInfoEtc.message);
  const { pkgInfo, popularityLevel } = pkgInfoEtc;

  const reviews = getReviews(prInfo);
  const latestReview = max(reviews.map((r) => r.date));
  const comments = noNullish(prInfo.comments.nodes);
  const mergeOfferDate = getMergeOfferDate(comments, prInfo.headRefOid);
  const mergeRequest = getMergeRequest(
    comments,
    pkgInfo.filter((p) => p.name).length === 1 ? [author, ...pkgInfo.find((p) => p.name)!.owners] : [author],
    max([createdDate, reopenedDate, lastPushDate]),
  );
  const lastActivityDate = max([
    createdDate,
    lastPushDate,
    lastCommentDate,
    blessing?.date,
    reopenedDate,
    latestReview,
  ]);
  const mainBotCommentID = getMainCommentID(comments);
  return {
    type: "info",
    now,
    pr_number: prInfo.number,
    author,
    headCommitOid: prInfo.headRefOid,
    mergeBaseOid: baseId, // not needed, kept for debugging
    lastPushDate,
    lastActivityDate,
    maintainerBlessed: blessing?.column,
    mergeOfferDate,
    mergeRequestDate: mergeRequest?.date,
    mergeRequestUser: mergeRequest?.user,
    hasMergeConflict: prInfo.mergeable === "CONFLICTING",
    isFirstContribution,
    tooManyFiles,
    hugeChange,
    popularityLevel,
    pkgInfo,
    reviews,
    mainBotCommentID,
    ...getCIResult(headCommit.checkSuites),
  };

  function botError(message: string): BotError {
    return { type: "error", now, message, author: prInfo.author?.login };
  }

  function botEnsureRemovedFromProject(message: string): BotEnsureRemovedFromProject {
    return { type: "remove", now, message, isDraft: prInfo.isDraft };
  }
}

/** Either: when the PR was last opened, or switched to ready from draft */
function getReopenedDate(timelineItems: PR_repository_pullRequest_timelineItems) {
  return (
    someLast(
      timelineItems.nodes,
      (item) =>
        (item.__typename === "ReopenedEvent" || item.__typename === "ReadyForReviewEvent") && new Date(item.createdAt),
    ) || undefined
  );
}

function getMainCommentID(comments: PR_repository_pullRequest_comments_nodes[]) {
  const comment = comments.find((c) => !authorNotBot(c) && c.body.includes("<!--typescript_bot_welcome-->"));
  if (!comment) return undefined;
  return comment.databaseId!;
}

function getLastCommentishActivityDate(prInfo: PR_repository_pullRequest) {
  const getCommentDate = (comment: { createdAt: string }) => new Date(comment.createdAt);
  const latestIssueCommentDate = noNullish(prInfo.comments.nodes).filter(authorNotBot).map(getCommentDate);
  const latestReviewCommentDate = noNullish(prInfo.reviews?.nodes).map((review) =>
    max(noNullish(review.comments.nodes).map(getCommentDate)),
  );
  return max([...latestIssueCommentDate, ...latestReviewCommentDate]);
}

function getLastMaintainerBlessing(
  after: Date,
  pr: PR_repository_pullRequest,
): { date: Date | undefined; column: BlessedColumnName } | undefined {
  const card = pr.projectItems.nodes?.find((card) => card?.project.number === projectBoardNumber);
  const columnName =
    card?.fieldValueByName?.__typename === "ProjectV2ItemFieldSingleSelectValue" && card.fieldValueByName.name;
  if (columnName && isBlessedColumnName(columnName) && card?.updatedAt) {
    // Normally relying on the updatedAt of the card is not reliable, but in this case it's fine
    // becuase the bot will never move the card into the blessed state, only out of it.
    // If the card is already in a blessed state, the bot will not mutate the card.
    const d = new Date(card.updatedAt);
    if (d <= after) return undefined;
    return { date: undefined, column: columnName };
  }

  // This doesn't work with the Projects V2, but is needed for old tests.
  // If V2 ever adds an API for this, we should drop the special "blessed" column above
  // and just reuse the below.
  // https://github.com/orgs/community/discussions/49602
  // https://github.com/orgs/community/discussions/57326
  const timelineItems = pr.timelineItems;
  return (
    someLast(timelineItems.nodes, (item) => {
      if (!(item.__typename === "MovedColumnsInProjectEvent" && authorNotBot(item))) return undefined;
      const d = new Date(item.createdAt);
      if (d <= after) return undefined;
      const columnName = item.projectColumnName as ColumnName;
      const blessedColumnName = columnNameToBlessed[columnName];
      if (blessedColumnName) {
        return { date: d, column: blessedColumnName };
      }
      return undefined;
    }) || undefined
  );
}

async function getPackageInfosEtc(
  paths: string[],
  headId: string,
  baseId: string,
  fetchFile: typeof defaultFetchFile,
  getDownloads: typeof getMonthlyDownloadCount,
): Promise<{ pkgInfo: PackageInfo[]; popularityLevel: PopularityLevel } | Error> {
  const infos = new Map<string | null, FileInfo[]>();
  for (const path of paths) {
    const [pkg, fileInfo] = await categorizeFile(path, headId, baseId, fetchFile);
    if (!infos.has(pkg)) infos.set(pkg, []);
    infos.get(pkg)!.push(fileInfo);
  }
  const result: PackageInfo[] = [];
  let maxDownloads = 0;
  for (const [name, files] of infos) {
    const oldOwners = !name ? null : await getOwnersOfPackage(name, baseId, fetchFile);
    if (oldOwners instanceof Error) return oldOwners;
    const newOwners0 = !name ? null : await getOwnersOfPackage(name, headId, fetchFile);
    // A header error is still an add/edit whereas a missing file is
    // delete, hence newOwners0 here
    const kind = !name ? "edit" : !oldOwners ? "add" : !newOwners0 ? "delete" : "edit";
    // treats a header error as a missing file, the CI will fail anyway
    // (maybe add a way to pass the error in the info so people don't need to read the CI?)
    const newOwners = newOwners0 instanceof Error ? null : newOwners0;
    const owners = oldOwners || [];
    const addedOwners =
      newOwners === null ? [] : oldOwners === null ? newOwners : newOwners.filter((o) => !oldOwners.includes(o));
    const deletedOwners =
      oldOwners === null ? [] : newOwners === null ? [] : oldOwners.filter((o) => !newOwners.includes(o));
    // null name => infra => ensure critical (even though it's unused atm)
    const downloads = name ? await getDownloads(name) : Infinity;
    if (name && downloads > maxDownloads) maxDownloads = downloads;
    // keep the popularity level and not the downloads since that can change often
    const popularityLevel = downloadsToPopularityLevel(downloads);
    const isSafeInfrastructureEdit =
      name === null
        ? kind === "edit" &&
          files.length === 1 &&
          files[0]?.path === "attw.json" &&
          (await isAllowedAttwEdit(headId, baseId, fetchFile))
        : undefined;
    result.push({ name, kind, files, owners, addedOwners, deletedOwners, popularityLevel, isSafeInfrastructureEdit });
  }
  return { pkgInfo: result, popularityLevel: downloadsToPopularityLevel(maxDownloads) };
}

async function categorizeFile(
  path: string,
  newId: string,
  oldId: string,
  fetchFile: typeof defaultFetchFile,
): Promise<[string | null, FileInfo]> {
  const pkg = /^types\/(.*?)\/.*$/.exec(path)?.[1];
  if (!pkg) return [null, { path, kind: "infrastructure" }];

  if (isDeclarationPath(path)) return [pkg, { path, kind: "definition" }];
  if (/\.(?:[cm]?ts|tsx)$/.test(path)) return [pkg, { path, kind: "test" }];
  if (path.endsWith(".md")) return [pkg, { path, kind: "markdown" }];

  const contentGetter = (oid: string) => async () => fetchFile(`${oid}:${path}`);
  const suspect = await configSuspicious(path, contentGetter(newId), contentGetter(oldId));
  return [pkg, { path, kind: suspect ? "package-meta" : "package-meta-ok", suspect }];
}

async function isAllowedAttwEdit(headId: string, baseId: string, fetchFile: typeof defaultFetchFile): Promise<boolean> {
  try {
    const newAttwJson = JSON.parse((await fetchFile(`${headId}:attw.json`))!);
    const oldAttwJson = JSON.parse((await fetchFile(`${baseId}:attw.json`))!);
    const { failingPackages: newFailing, ...newAttw } = newAttwJson;
    const { failingPackages: oldFailing, ...oldAttw } = oldAttwJson;
    if (!isDeepStrictEqual(newAttw, oldAttw)) return false;
    return newFailing.length < oldFailing.length && newFailing.every((p: string) => oldFailing.includes(p));
  } catch {
    return false;
  }
}

interface ConfigSuspicious {
  (
    path: string,
    getNew: () => Promise<string | undefined>,
    getOld: () => Promise<string | undefined>,
  ): Promise<string | undefined>;
  [basename: string]: (text: string, oldText?: string) => string | undefined;
}
const configSuspicious = <ConfigSuspicious>(async (path, newContents, oldContents) => {
  let basename = path.replace(/.*\//, "");
  if (basename.startsWith("tsconfig.") && basename.endsWith(".json")) {
    basename = "tsconfig.json";
  }
  const checker = configSuspicious[basename];
  if (!checker) return `edited`;
  const text = await newContents();
  // Removing tslint.json, tsconfig.json, package.json and
  // OTHER_FILES.txt is checked by the CI. Specifics are in my commit
  // message.
  if (text === undefined) return undefined;
  const oldText = await oldContents();
  return checker(text, oldText);
});
configSuspicious["package.json"] = () => undefined;
configSuspicious[".npmignore"] = () => undefined;
configSuspicious["tsconfig.json"] = makeChecker(
  {
    compilerOptions: {
      lib: ["es6"],
      noImplicitAny: true,
      noImplicitThis: true,
      strictFunctionTypes: true,
      strictNullChecks: true,
      types: [],
      noEmit: true,
      forceConsistentCasingInFileNames: true,
    },
  },
  urls.tsconfigJson,
  {
    ignore: (data) => {
      if (!data || typeof data !== "object") return;

      if (
        "compilerOptions" in data &&
        data.compilerOptions &&
        typeof data.compilerOptions === "object" &&
        !Array.isArray(data.compilerOptions)
      ) {
        if (Array.isArray(data.compilerOptions.lib)) {
          data.compilerOptions.lib = data.compilerOptions.lib.filter(
            (value: unknown) => !(typeof value === "string" && value.toLowerCase() === "dom"),
          );
        }
        for (const k of ["baseUrl", "typeRoots", "paths", "jsx", "module"]) {
          if (k in data.compilerOptions) delete data.compilerOptions[k];
        }
        if (typeof data.compilerOptions.target === "string" && data.compilerOptions.target.toLowerCase() === "es6") {
          delete data.compilerOptions.target;
        }
      }

      if ("files" in data) delete data.files;
    },
  },
);

type JSONLike = boolean | number | string | null | { [key: string]: JSONLike } | JSONLike[];

// helper for file checkers: allow either a given "expectedForm", or any edits that get closer
// to it, ignoring some keys.  The ignored properties are in most cases checked
// elsewhere (dtslint), and in some cases they are irrelevant.
function makeChecker(
  expectedForm: any,
  expectedFormUrl: string,
  options?: { parse?: (text: string) => JSONLike; ignore?: (data: JSONLike) => void },
) {
  const diffFromExpected = (text: string) => {
    let data: any;
    if (options?.parse) {
      data = options.parse(text);
    } else {
      try {
        data = JSON.parse(text);
      } catch (e) {
        return "couldn't parse json";
      }
    }
    options?.ignore?.(data);
    try {
      return jsonDiff.compare(expectedForm, data);
    } catch (e) {
      return "couldn't diff json";
    }
  };
  return (contents: string, oldText?: string) => {
    const theExpectedForm = `[the expected form](${expectedFormUrl})`;
    const newDiff = diffFromExpected(contents);
    if (typeof newDiff === "string") return newDiff;
    if (newDiff.length === 0) return undefined;
    const diffDescription = newDiff.every((d) => /^\/[0-9]+($|\/)/.test(d.path))
      ? ""
      : ` (check: ${newDiff.map((d) => `\`${d.path.slice(1).replace(/\//g, ".")}\``).join(", ")})`;
    if (!oldText) return `not ${theExpectedForm}${diffDescription}`;
    const oldDiff = diffFromExpected(oldText);
    if (typeof oldDiff === "string") return oldDiff;
    if (jsonDiff.compare(oldDiff, newDiff).every(({ op }) => op === "remove")) return undefined;
    return `not ${theExpectedForm} and not moving towards it${diffDescription}`;
  };
}

function latestComment(comments: PR_repository_pullRequest_comments_nodes[]) {
  return max(comments, (r, c) => Date.parse(r.createdAt) - Date.parse(c.createdAt));
}

function getMergeOfferDate(comments: PR_repository_pullRequest_comments_nodes[], headOid: string) {
  const offer = latestComment(
    comments.filter(
      (c) =>
        sameUser("typescript-bot", c.author?.login || "-") &&
        comment.parse(c.body)?.tag === "merge-offer" &&
        c.body.includes(`(at ${abbrOid(headOid)})`),
    ),
  );
  return offer && new Date(offer.createdAt);
}

function getMergeRequest(comments: PR_repository_pullRequest_comments_nodes[], users: string[], sinceDate: Date) {
  const request = latestComment(
    comments.filter(
      (comment) =>
        users.some((u) => comment.author && sameUser(u, comment.author.login)) &&
        comment.body.split("\n").some((line) => line.trim().toLowerCase().startsWith("ready to merge")),
    ),
  );
  if (!request) return request;
  const date = new Date(request.createdAt);
  return date > sinceDate ? { date, user: request.author!.login } : undefined;
}

function getReviews(prInfo: PR_repository_pullRequest) {
  if (!prInfo.reviews?.nodes) return [];
  const headCommitOid: string = prInfo.headRefOid;
  const reviews: ReviewInfo[] = [];
  // Do this in reverse order so we can detect up-to-date-reviews correctly
  for (const r of noNullish(prInfo.reviews.nodes).reverse()) {
    const [reviewer, date] = [r.author?.login, new Date(r.submittedAt)];
    // Skip nulls
    if (!(r.commit && reviewer)) continue;
    // Skip self-reviews
    if (reviewer === prInfo.author!.login) continue;
    // Only look at the most recent review per person (ignoring pending/commented)
    if (reviews.some((r) => sameUser(r.reviewer, reviewer))) continue;
    // collect reviews by type
    if (r.commit.oid !== headCommitOid) {
      reviews.push({ type: "stale", reviewer, date, abbrOid: abbrOid(r.commit.oid) });
      continue;
    }
    if (r.state === "CHANGES_REQUESTED") {
      reviews.push({ type: "changereq", reviewer, date });
      continue;
    }
    if (r.state !== "APPROVED") continue;
    const isMaintainer = r.authorAssociation === "MEMBER" || r.authorAssociation === "OWNER";
    reviews.push({ type: "approved", reviewer, date, isMaintainer });
  }
  return reviews;
}

function getCIResult(checkSuites: PR_repository_pullRequest_commits_nodes_commit_checkSuites | null): {
  ciResult: CIResult;
  ciUrl?: string;
  reRunCheckSuiteIDs?: number[];
} {
  const ghActionsChecks = checkSuites?.nodes?.filter((check) => check?.app?.name.includes("GitHub Actions"));

  // Freakin' crypto miners ruined GitHub Actions, and now we need to manually confirm new folks can run CI
  const actionRequiredIDs = noNullish(
    ghActionsChecks?.map((check) => (check?.conclusion === "ACTION_REQUIRED" ? check.databaseId : null)),
  );
  if (actionRequiredIDs.length > 0) return { ciResult: "action_required", reRunCheckSuiteIDs: actionRequiredIDs };

  const latestChecks = [];
  const checksByWorkflowPath = new Map<string, PR_repository_pullRequest_commits_nodes_commit_checkSuites_nodes>();

  // Attempt to use only the latest run for a given workflow on a given commit.
  // This may still be wrong if we _remove_ a workflow, but it's better than always
  // taking the first one.
  for (const check of ghActionsChecks || []) {
    if (!check) {
      continue;
    }

    const workflowPath = check.workflowRun?.file?.path;
    if (!workflowPath) {
      latestChecks.push(check);
      continue;
    }

    const existingCheck = checksByWorkflowPath.get(workflowPath);
    // createdAt is an ISO8601 string, so we can safely just compare.
    if (!existingCheck || existingCheck.createdAt < check.createdAt) {
      checksByWorkflowPath.set(workflowPath, check);
    }
  }

  latestChecks.push(...checksByWorkflowPath.values());

  if (latestChecks.length === 0) {
    return { ciResult: "missing", ciUrl: undefined };
  }

  for (const check of latestChecks) {
    switch (check.conclusion) {
      case "SUCCESS":
        continue;
      case "FAILURE":
      case "SKIPPED":
      case "TIMED_OUT":
        return { ciResult: "fail", ciUrl: check.url };
      default:
        return { ciResult: "unknown" };
    }
  }

  return { ciResult: "pass" };
}

function downloadsToPopularityLevel(monthlyDownloads: number): PopularityLevel {
  return monthlyDownloads > criticalPopularityThreshold
    ? "Critical"
    : monthlyDownloads > normalPopularityThreshold
      ? "Popular"
      : "Well-liked by everyone";
}

export async function getOwnersOfPackage(
  packageName: string,
  oid: string,
  fetchFile: typeof defaultFetchFile,
): Promise<string[] | null | Error> {
  const packageJson = `${oid}:types/${packageName}/package.json`;
  const packageJsonContent = await fetchFile(packageJson, 10240); // grab at most 10k
  let packageJsonObj;
  if (packageJsonContent !== undefined) {
    try {
      packageJsonObj = JSON.parse(packageJsonContent);
    } catch (e) {
      if (e instanceof Error) return new Error(`error parsing owners from package.json: ${e.message}`);
    }
  }

  if (!packageJsonObj || !(packageJsonObj.name && packageJsonObj.version && packageJsonObj.owners)) {
    // If we see that we're not in a post-pnpm world, try to get the owners from the index.d.ts.
    const indexDts = `${oid}:types/${packageName}/index.d.ts`;
    const indexDtsContent = await fetchFile(indexDts, 10240); // grab at most 10k
    if (indexDtsContent === undefined) return null;
    let parsed: OldHeaderParser.Header;
    try {
      parsed = OldHeaderParser.parseHeaderOrFail(indexDts, indexDtsContent);
    } catch (e) {
      if (e instanceof Error) return new Error(`error parsing owners: ${e.message}`);
    }
    return noNullish(parsed!.contributors.map((c) => c.githubUsername));
  }

  return noNullish(packageJsonObj.owners?.map((c: any) => c?.githubUsername));
}
