import { ColumnName, LabelName, StalenessKind, ApproverKind } from "./basic";
import * as Comments from "./comments";
import * as emoji from "./emoji";
import * as urls from "./urls";
import { PrInfo, BotResult, FileInfo, ReviewInfo } from "./pr-info";
import { noNullish, flatten, unique, sameUser, min, sha256, abbrOid, txt } from "./util/util";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
dayjs.extend(advancedFormat);

export interface Actions {
  projectColumn?: ColumnName;
  labels: LabelName[];
  responseComments: Comments.Comment[];
  shouldClose: boolean;
  shouldMerge: boolean;
  shouldUpdateLabels: boolean;
  reRunActionsCheckSuiteIDs?: number[];
}

function createDefaultActions(): Actions {
  return {
    projectColumn: "Other",
    labels: [],
    responseComments: [],
    shouldClose: false,
    shouldMerge: false,
    shouldUpdateLabels: true,
  };
}

function createEmptyActions(): Actions {
  return {
    labels: [],
    responseComments: [],
    shouldClose: false,
    shouldMerge: false,
    shouldUpdateLabels: false,
  };
}

interface Staleness {
  readonly kind: StalenessKind;
  readonly days: number;
  readonly state: "fresh" | "attention" | "nearly" | "done";
  readonly explanation?: string;
  readonly doTimelineActions: (actions: Actions) => void;
}

// used to pass around pr info with additional values
interface ExtendedPrInfo extends PrInfo {
  readonly orig: PrInfo;
  readonly editsInfra: boolean;
  readonly possiblyEditsInfra: boolean; // if we can't be sure since there's too many files
  readonly checkConfig: boolean;
  readonly authorIsOwner: boolean;
  readonly allOwners: string[];
  readonly otherOwners: string[];
  readonly noOtherOwners: boolean;
  readonly tooManyOwners: boolean;
  readonly editsOwners: boolean;
  readonly canBeSelfMerged: boolean;
  readonly hasValidMergeRequest: boolean; // has request following an offer
  readonly pendingCriticalPackages: readonly string[]; // critical packages that need owner approval
  readonly approved: boolean;
  readonly approverKind: ApproverKind;
  readonly requireMaintainer: boolean;
  readonly blessable: boolean;
  readonly blessed: boolean;
  readonly approvedReviews: (ReviewInfo & { type: "approved" })[];
  readonly changereqReviews: (ReviewInfo & { type: "changereq" })[];
  readonly staleReviews: (ReviewInfo & { type: "stale" })[];
  readonly approvedBy: ApproverKind[];
  readonly hasChangereqs: boolean;
  readonly failedCI: boolean;
  readonly blockedCI: boolean;
  readonly staleness?: Staleness;
  readonly packages: readonly string[];
  readonly hasMultiplePackages: boolean; // not counting infra files
  readonly hasDefinitions: boolean;
  readonly hasTests: boolean;
  readonly isUntested: boolean;
  readonly newPackages: readonly string[];
  readonly hasNewPackages: boolean;
  readonly hasEditedPackages: boolean;
  readonly needsAuthorAction: boolean;
  readonly reviewColumn: ColumnName;
  readonly isAuthor: (user: string) => boolean; // specialized version of sameUser
}
function extendPrInfo(info: PrInfo): ExtendedPrInfo {
  const isAuthor = (user: string) => sameUser(user, info.author);
  const authorIsOwner = info.pkgInfo.every((p) => p.owners.some(isAuthor));
  const editsInfra = info.pkgInfo.some((p) => p.name === null && !p.isSafeInfrastructureEdit);
  const possiblyEditsInfra = editsInfra || info.tooManyFiles;
  const checkConfig = info.pkgInfo.some((p) => p.files.some((f) => f.kind === "package-meta"));
  const allOwners = unique(flatten(info.pkgInfo.map((p) => p.owners)));
  const otherOwners = allOwners.filter((o) => !isAuthor(o));
  const noOtherOwners = otherOwners.length === 0;
  const tooManyOwners = allOwners.length > 50;
  const editsOwners = info.pkgInfo.some((p) => p.kind === "edit" && p.addedOwners.length + p.deletedOwners.length > 0);
  const packages = noNullish(info.pkgInfo.map((p) => p.name));
  const hasMultiplePackages = packages.length > 1;
  const hasDefinitions = info.pkgInfo.some((p) => p.files.some((f) => f.kind === "definition"));
  const hasTests = info.pkgInfo.some((p) => p.files.some((f) => f.kind === "test"));
  const isUntested = hasDefinitions && !hasTests;
  const newPackages = noNullish(info.pkgInfo.map((p) => (p.kind === "add" ? p.name : null)));
  const hasNewPackages = newPackages.length > 0;
  const hasEditedPackages = packages.length > newPackages.length;
  const requireMaintainer =
    possiblyEditsInfra || checkConfig || hasMultiplePackages || isUntested || hasNewPackages || tooManyOwners;
  const blessable = !(hasNewPackages || possiblyEditsInfra || noOtherOwners);
  const blessed = blessable && isBlessed();
  const approvedReviews = info.reviews.filter((r) => r.type === "approved") as ExtendedPrInfo["approvedReviews"];
  const changereqReviews = info.reviews.filter((r) => r.type === "changereq") as ExtendedPrInfo["changereqReviews"];
  const staleReviews = info.reviews.filter((r) => r.type === "stale") as ExtendedPrInfo["staleReviews"];
  const hasChangereqs = changereqReviews.length > 0;
  const approvedBy = getApprovedBy();
  const pendingCriticalPackages = getPendingCriticalPackages();
  const approverKind = getApproverKind();
  const approved = getApproved();
  const failedCI = info.ciResult === "fail";
  const blockedCI = info.ciResult === "action_required";
  const ciResult = blockedCI && !possiblyEditsInfra ? "unknown" : info.ciResult; // override ciResult: treated as in-progress if it's approved (blockedCI distinguishes it from real unknown)
  const canBeSelfMerged = info.ciResult === "pass" && !info.hasMergeConflict && approved;
  const hasValidMergeRequest = !!(
    info.mergeOfferDate &&
    info.mergeRequestDate &&
    info.mergeRequestDate > info.mergeOfferDate
  );
  const needsAuthorAction = failedCI || info.hasMergeConflict || hasChangereqs;
  //      => could be dropped from the extended info and replaced with: info.staleness?.kind === "Abandoned"
  const staleness = getStaleness();
  const reviewColumn = getReviewColumn();
  return {
    ...info,
    orig: info,
    authorIsOwner,
    editsInfra,
    possiblyEditsInfra,
    checkConfig,
    allOwners,
    otherOwners,
    noOtherOwners,
    tooManyOwners,
    editsOwners,
    canBeSelfMerged,
    hasValidMergeRequest,
    pendingCriticalPackages,
    approved,
    approverKind,
    requireMaintainer,
    blessable,
    blessed,
    failedCI,
    blockedCI,
    ciResult,
    staleness,
    packages,
    hasMultiplePackages,
    hasDefinitions,
    hasTests,
    isUntested,
    newPackages,
    hasNewPackages,
    hasEditedPackages,
    approvedReviews,
    changereqReviews,
    staleReviews,
    approvedBy,
    hasChangereqs,
    needsAuthorAction,
    reviewColumn,
    isAuthor,
  };

  // Staleness timeline configurations (except for texts that are all in `comments.ts`)
  function getStaleness() {
    const ownersToPing =
      otherOwners.length === 0
        ? ["«anyone?»"]
        : otherOwners.filter((o) => !approvedReviews.some((r) => o === r.reviewer));
    const mkStaleness = makeStaleness(info.now, info.author, ownersToPing);
    if (canBeSelfMerged)
      return (
        info.mergeOfferDate &&
        mkStaleness(
          // no merge offer yet: avoid the unreviewed timeline
          "Unmerged",
          info.mergeOfferDate,
          4,
          9,
          30,
          "*REMOVE*",
        )
      );
    if (needsAuthorAction) return mkStaleness("Abandoned", info.lastActivityDate, 6, 22, 30, "*REMOVE*");
    if (!approved) return mkStaleness("Unreviewed", info.lastPushDate, 6, 10, 17, "Needs Maintainer Action");
    return undefined;
  }

  function isBlessed(): boolean {
    return info.maintainerBlessed === "Waiting for Code Reviews (Blessed)";
  }

  function getApprovedBy() {
    return hasChangereqs
      ? []
      : approvedReviews.map((r) =>
          r.isMaintainer ? "maintainer" : allOwners.some((o) => sameUser(o, r.reviewer)) ? "owner" : "other",
        );
  }

  function getPendingCriticalPackages() {
    return noNullish(
      info.pkgInfo.map((p) =>
        p.popularityLevel === "Critical" && !p.owners.some((o) => approvedReviews.some((r) => sameUser(o, r.reviewer)))
          ? p.name
          : null,
      ),
    );
  }

  function getApproverKind() {
    const who: ApproverKind = requireMaintainer
      ? "maintainer"
      : (
          {
            "Well-liked by everyone": "other",
            Popular: "owner",
            Critical: "maintainer",
          } as const
        )[info.popularityLevel];
    return who === "maintainer" && blessed ? "owner" : who === "owner" && noOtherOwners ? "maintainer" : who;
  }

  function getApproved() {
    if (approvedBy.includes("maintainer")) return true; // maintainer approval => no need for anything else
    return (
      pendingCriticalPackages.length === 0 &&
      approvedBy.length > 0 &&
      (approverKind === "other" || approvedBy.includes("maintainer") || approvedBy.includes(approverKind))
    );
  }

  function getReviewColumn(): ColumnName {
    // Get the project column for review with least access
    // E.g. let people review, but fall back to the DT maintainers based on the access rights above
    return blessed
      ? "Waiting for Code Reviews (Blessed)"
      : approverKind !== "maintainer"
        ? "Waiting for Code Reviews"
        : blessable
          ? "Needs Maintainer Review"
          : "Needs Maintainer Action";
  }
}

export function process(prInfo: BotResult, extendedCallback: (info: ExtendedPrInfo) => void = (_i) => {}): Actions {
  if (prInfo.type === "remove") {
    return {
      ...createEmptyActions(),
      projectColumn: prInfo.isDraft ? "Needs Author Action" : "*REMOVE*",
    };
  }

  const actions = createDefaultActions();
  const post = (c: Comments.Comment) => actions.responseComments.push(c);

  if (prInfo.type === "error") {
    actions.projectColumn = "Other";
    actions.labels.push("Mergebot Error");
    post(Comments.hadError(prInfo.author, prInfo.message));
    return actions;
  }

  // Collect some additional info
  const info = extendPrInfo(prInfo);
  extendedCallback(info);

  // General labelling and housekeeping
  const label = (label: LabelName, cond: unknown = true) => {
    const i = actions.labels.indexOf(label);
    if (cond && i < 0) actions.labels.push(label);
    else if (!cond && i >= 0) actions.labels.splice(i, 1);
  };
  label("Has Merge Conflict", info.hasMergeConflict);
  label("The CI failed", info.failedCI);
  label("The CI is blocked", info.ciResult === "action_required");
  label("Revision needed", info.hasChangereqs);
  label("Critical package", info.popularityLevel === "Critical");
  label("Popular package", info.popularityLevel === "Popular");
  label("Other Approved", info.approvedBy.includes("other"));
  label("Owner Approved", info.approvedBy.includes("owner") && info.pendingCriticalPackages.length === 0); // and *all* owners of critical packages
  label("Maintainer Approved", info.approvedBy.includes("maintainer"));
  label("New Definition", info.hasNewPackages);
  label("Edits Owners", info.editsOwners);
  label("Edits Infrastructure", info.editsInfra);
  label("Possibly Edits Infrastructure", info.possiblyEditsInfra && !info.editsInfra);
  label("Edits multiple packages", info.hasMultiplePackages);
  label("Author is Owner", info.authorIsOwner);
  label("No Other Owners", info.hasEditedPackages && info.noOtherOwners);
  label("Too Many Owners", info.tooManyOwners);
  label("Check Config", info.checkConfig);
  label("Untested Change", info.isUntested);
  label("Too Many Files", info.tooManyFiles);
  label("Huge Change", info.hugeChange);
  if (info.staleness?.state === "nearly" || info.staleness?.state === "done") label(info.staleness.kind);

  // Update intro comment
  post({ tag: "welcome", status: createWelcomeComment(info, post) });

  // Ping reviewers when needed
  const headCommitAbbrOid = abbrOid(info.headCommitOid);
  if (!(info.hasChangereqs || info.approvedBy.includes("owner") || info.approvedBy.includes("maintainer"))) {
    if (info.noOtherOwners) {
      if (info.popularityLevel !== "Critical") {
        const authorIsNewOwner = flatten(info.pkgInfo.map((p) => p.addedOwners)).includes(info.author);
        post(
          Comments.pingReviewersOther(info.author, info.authorIsOwner || authorIsNewOwner, urls.review(info.pr_number)),
        );
      }
    } else if (info.tooManyOwners) {
      post(Comments.pingReviewersTooMany(info.otherOwners));
    } else {
      post(Comments.pingReviewers(info.otherOwners, urls.review(info.pr_number)));
    }
  }

  // Some step should override actions.projectColumn, the default "Other" indicates a problem
  if (info.author === "github-actions") {
    actions.projectColumn = "Needs Maintainer Action";
    return actions;
  }

  // First-timers are blocked from CI runs until approved, this case is for infra edits (require a maintainer)
  if (info.ciResult === "action_required") {
    actions.projectColumn = "Needs Maintainer Action";
  }
  // Needs author attention (bad CI, merge conflicts)
  else if (info.needsAuthorAction) {
    actions.projectColumn = "Needs Author Action";
    if (info.hasMergeConflict) post(Comments.mergeConflicted(headCommitAbbrOid, info.author));
    if (info.failedCI) post(Comments.ciFailed(headCommitAbbrOid, info.author, info.ciUrl!));
    if (info.hasChangereqs) post(Comments.changesRequest(headCommitAbbrOid, info.author));
  }
  // CI is running; default column is Waiting for Reviewers
  else if (info.ciResult === "unknown") {
    actions.projectColumn = "Waiting for Code Reviews";
    if (info.blockedCI)
      // => we should approve the tests (by rerunning)
      actions.reRunActionsCheckSuiteIDs = info.reRunCheckSuiteIDs || undefined;
  }
  // CI is missing
  else if (info.ciResult === "missing") {
    // This bot is faster than CI in coming back to give a response, and so the bot starts flipping between
    // a 'where is CI'-ish state and a 'got CI deets' state. To work around this, we wait a
    // minute since the last timeline push action before label/project states can be updated
    if (dayjs(info.now).diff(info.lastPushDate, "minutes") >= 1) {
      label("Where is GH Actions?");
    } else {
      delete actions.projectColumn;
    }
  }
  // CI is green
  else if (info.ciResult === "pass") {
    if (!info.canBeSelfMerged) {
      actions.projectColumn = info.reviewColumn;
    } else {
      label("Self Merge");
      // post even when merging, so it won't get deleted
      post(
        Comments.offerSelfMerge(
          info.author,
          info.tooManyOwners || info.hasMultiplePackages ? [] : info.otherOwners,
          headCommitAbbrOid,
        ),
      );
      if (info.hasValidMergeRequest) {
        actions.shouldMerge = true;
        actions.projectColumn = "Recently Merged";
      } else {
        actions.projectColumn = "Waiting for Author to Merge";
      }
    }
    // Ping stale reviewers if any
    if (info.staleReviews.length > 0) {
      const { abbrOid } = min(info.staleReviews, (l, r) => +l.date - +r.date)!;
      const reviewers = info.staleReviews.map((r) => r.reviewer);
      post(Comments.pingStaleReviewer(abbrOid, reviewers));
    }
  }

  if (!actions.shouldMerge && info.mergeRequestUser) {
    post(Comments.waitUntilMergeIsOK(info.mergeRequestUser, headCommitAbbrOid, urls.workflow, info.mainBotCommentID));
  }

  // Has it: got no DT tests but is approved by DT modules and basically blocked by the DT maintainers - and it has been over 3 days?
  // Send a message reminding them that they can un-block themselves by adding tests.
  if (
    !info.hasTests &&
    !info.hasMultiplePackages &&
    info.approvedBy.includes("owner") &&
    !info.editsInfra &&
    info.approverKind === "maintainer" &&
    (info.staleness?.days ?? 0) > 3
  ) {
    post(
      Comments.remindPeopleTheyCanUnblockPR(
        info.author,
        info.approvedReviews.map((r) => r.reviewer),
        info.ciResult === "pass",
        headCommitAbbrOid,
      ),
    );
  }

  // Timeline-related actions
  info.staleness?.doTimelineActions(actions);

  return actions;
}

function makeStaleness(now: Date, author: string, ownersToPing: string[]) {
  // curried for convenience
  return (
    kind: StalenessKind,
    since: Date,
    freshDays: number,
    attnDays: number,
    nearDays: number,
    doneColumn: ColumnName,
  ) => {
    const days = dayjs(now).diff(since, "days");
    const state = days <= freshDays ? "fresh" : days <= attnDays ? "attention" : days <= nearDays ? "nearly" : "done";
    const kindAndState = `${kind}:${state}`;
    const explanation = Comments.stalenessExplanations[kindAndState];
    const expires = dayjs(since).add(nearDays, "days").format("MMM Do");
    const comment = Comments.stalenessComment(author, ownersToPing, expires)[kindAndState];
    const doTimelineActions = (actions: Actions) => {
      if (comment !== undefined) {
        const tag = state === "done" ? kindAndState : `${kindAndState}:${since.toISOString().replace(/T.*$/, "")}`;
        actions.responseComments.push({ tag, status: comment });
      }
      if (state === "done") {
        if (doneColumn === "*REMOVE*") actions.shouldClose = true; // close when reming
        actions.projectColumn = doneColumn;
      }
    };
    return { kind, days, state, explanation, doTimelineActions } as const;
  };
}

function createWelcomeComment(info: ExtendedPrInfo, post: (c: Comments.Comment) => void) {
  let content = "";
  function display(...lines: string[]) {
    lines.forEach((line) => (content += line + "\n"));
  }

  const testsLink = info.hasNewPackages ? urls.testingNewPackages : urls.testingEditedPackages;

  const specialWelcome = info.isFirstContribution
    ? txt`| I see this is your first time submitting to DefinitelyTyped 👋
             — I'm the local bot who will help you through the process of getting things through.`
    : info.author === "github-actions"
      ? "From one bot to another, beep bloop boople bloop."
      : "";
  display(
    `@${info.author} Thank you for submitting this PR!${specialWelcome}`,
    ``,
    `***This is a live comment that I will keep updated.***`,
  );

  const criticalNum = info.pkgInfo.reduce((num, pkg) => (pkg.popularityLevel === "Critical" ? num + 1 : num), 0);
  if (criticalNum === 0 && info.popularityLevel === "Critical")
    throw new Error("Internal Error: unexpected criticalNum === 0");
  const requiredApproverLower =
    info.approverKind === "other"
      ? "type definition owners, DT maintainers or others"
      : info.approverKind === "maintainer"
        ? "a DT maintainer"
        : criticalNum <= 1
          ? "type definition owners or DT maintainers"
          : "all owners or a DT maintainer";
  const requiredApproverUpper = requiredApproverLower[0]!.toUpperCase() + requiredApproverLower.substring(1);

  if (info.isUntested) {
    post(Comments.suggestTesting(info.author, testsLink));
  } else if (info.possiblyEditsInfra) {
    display(
      ``,
      `This PR ${info.editsInfra ? "touches" : "might touch"} some part of DefinitelyTyped infrastructure, so ${requiredApproverLower} will need to review it. This is rare — did you mean to do this?`,
    );
  }

  const announceList = (what: string, xs: readonly string[]) => `${xs.length} ${what}${xs.length !== 1 ? "s" : ""}`;
  const usersToString = (users: string[]) => users.map((u) => (info.isAuthor(u) ? "✎" : "") + "@" + u).join(", ");
  const reviewLink = (f: FileInfo) =>
    `[\`${f.path.replace(/^types\/(.*\/)/, "$1")}\`](${urls.review(
      info.pr_number,
    )}/${info.headCommitOid}#diff-${sha256(f.path)})`;

  display(
    ``,
    `## ${announceList("package", info.packages)} in this PR${
      info.editsInfra ? " (and infra files)" : info.tooManyFiles ? " (and possibly others)" : ""
    }`,
    ``,
  );
  if (info.tooManyFiles) {
    display(``, `***Note: this PR touches too many files, check it!***`);
  }
  let addedSelfToManyOwners = 0;
  if (info.pkgInfo.length === 0) {
    display(`This PR is editing only infrastructure files!`);
  }
  for (const p of info.pkgInfo) {
    if (p.name === null) continue;
    const kind = p.kind === "add" ? " (*new!*)" : p.kind === "delete" ? " (*probably deleted!*)" : "";
    const urlPart = p.name.replace(/^(.*?)__(.)/, "@$1/$2");
    const authorIsOwner = !p.owners.some(info.isAuthor) ? [] : [`(author is owner)`];
    display(
      [
        `* \`${p.name}\`${kind} —`,
        `[on npm](https://www.npmjs.com/package/${urlPart}),`,
        `[on unpkg](https://unpkg.com/browse/${urlPart}@latest/)`,
        ...authorIsOwner,
      ].join(" "),
    );
    const approvers = info.approvedReviews
      .filter((r) => p.owners.some((o) => sameUser(o, r.reviewer)))
      .map((r) => r.reviewer);
    if (approvers.length) {
      display(`  - owner-approval: ${usersToString(approvers)}`);
    }
    const displayOwners = (what: string, owners: string[]) => {
      if (owners.length === 0) return;
      display(`  - ${announceList(`${what} owner`, owners)}: ${usersToString(owners)}`);
    };
    displayOwners("added", p.addedOwners);
    displayOwners("removed", p.deletedOwners);
    if (!info.authorIsOwner && p.owners.length >= 4 && p.addedOwners.some(info.isAuthor)) addedSelfToManyOwners++;
    let showSuspects = false;
    for (const file of p.files) {
      if (!file.suspect) continue;
      if (!showSuspects) display(`  - Config files to check:`);
      display(`    - ${reviewLink(file)}: ${file.suspect}`);
      showSuspects = true;
    }
  }
  if (info.editsInfra) {
    display(`* Infra files`);
    for (const file of info.pkgInfo.find((p) => p.name === null)!.files) display(`  - ${reviewLink(file)}`);
  }
  if (addedSelfToManyOwners > 0) {
    display(
      ``,
      txt`@${info.author}: I see that you have added yourself as an
                    owner${addedSelfToManyOwners > 1 ? " to several packages" : ""},
                    are you sure you want to [become an owner](${urls.definitionOwners})?`,
    );
  }

  // Lets the author know who needs to review this
  display(``, `## Code Reviews`, ``);
  if (info.hasNewPackages) {
    display(txt`This PR adds a new definition, so it needs to be reviewed by
                    ${requiredApproverLower} before it can be merged.`);
  } else if (info.popularityLevel === "Critical" && !info.blessed) {
    display(txt`Because this is a widely-used package, ${requiredApproverLower}
                    will need to review it before it can be merged.`);
  } else if (!info.requireMaintainer) {
    const and =
      info.hasDefinitions && info.hasTests ? "and updated the tests (👏)" : "and there were no type definition changes";
    display(txt`Because you edited one package ${and}, I can help you merge this PR
                    once someone else signs off on it.`);
  } else if (info.blessed) {
    display("This PR can be merged once it's reviewed.");
  } else {
    if (info.noOtherOwners) {
      display(txt`There aren't any other owners of this package,
                        so ${requiredApproverLower} will review it.`);
    } else if (info.hasMultiplePackages) {
      display(txt`Because this PR edits multiple packages, it can be merged
                        once it's reviewed by ${requiredApproverLower}.`);
    } else if (info.checkConfig) {
      display(txt`Because this PR edits the configuration file, it can be merged
                        once it's reviewed by ${requiredApproverLower}.`);
    } else if (info.hugeChange) {
      display(txt`Because this is a huge PR, it can be merged
                        once it's reviewed by ${requiredApproverLower}.`);
    } else {
      display(`This PR can be merged once it's reviewed by ${requiredApproverLower}.`);
    }
  }

  if (!info.tooManyFiles) {
    display(``, `You can test the changes of this PR [in the Playground](${urls.playground(info.pr_number)}).`);
  }

  display(``, `## Status`, ``, ` * ${emoji.failed(info.hasMergeConflict)} No merge conflicts`);
  {
    const result = emoji.result(info.ciResult);
    display(` * ${result.emoji} Continuous integration tests ${result.text}`);
  }

  const approved = emoji.pending(!info.approved);

  if (info.hasNewPackages) {
    display(` * ${approved} Only ${requiredApproverLower} can approve changes when there are new packages added`);
  } else if (info.editsInfra) {
    const infraFiles = info.pkgInfo.find((p) => p.name === null)!.files;
    const links = infraFiles.map(reviewLink);
    display(
      ` * ${approved} ${requiredApproverUpper} needs to approve changes that affect DT infrastructure (${links.join(", ")})`,
    );
  } else if (criticalNum > 1 && info.blessed) {
    display(` * ${approved} ${requiredApproverUpper} needs to approve changes that affect more than one package`);
    for (const p of info.pkgInfo) {
      if (!(p.name && p.popularityLevel === "Critical")) continue;
      display(`   - ${emoji.pending(info.pendingCriticalPackages.includes(p.name))} ${p.name}`);
    }
  } else if (info.hasMultiplePackages) {
    display(` * ${approved} ${requiredApproverUpper} needs to approve changes that affect more than one package`);
  } else if (!info.requireMaintainer || info.blessed) {
    display(` * ${approved} Most recent commit is approved by ${requiredApproverLower}`);
  } else if (info.noOtherOwners) {
    display(` * ${approved} ${requiredApproverUpper} can merge changes when there are no other reviewers`);
  } else if (info.checkConfig) {
    display(` * ${approved} ${requiredApproverUpper} needs to approve changes that affect module config files`);
  } else {
    display(` * ${approved} Only ${requiredApproverLower} can approve changes [without tests](${testsLink})`);
  }

  display(``);
  if (!info.canBeSelfMerged) {
    display(txt`Once every item on this list is checked,
                    I'll ask you for permission to merge and publish the changes.`);
  } else {
    display(txt`All of the items on the list are green.
                    **To merge, you need to post a comment including the string "Ready to merge"**
                    to bring in your changes.`);
  }

  if (info.staleness && info.staleness.state !== "fresh") {
    const expl = info.staleness.explanation;
    display(
      ``,
      `## Inactive`,
      ``,
      `This PR has been inactive for ${info.staleness.days} days${!expl ? "." : " — " + expl}`,
    );
  }

  // Remove the 'now' attribute because otherwise the comment would need editing every time
  // and that's spammy.
  const shallowPresentationInfoCopy = { ...info.orig, now: "-" };

  display(
    ``,
    `----------------------`,
    `<details><summary>Diagnostic Information: What the bot saw about this PR</summary>\n\n${
      "```json\n" + JSON.stringify(shallowPresentationInfoCopy, undefined, 2) + "\n```"
    }\n\n</details>`,
  );

  return content.trimEnd();
}
