/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

//==============================================================
// START Enums and Input Objects
//==============================================================

/**
 * The possible states for a check suite or run conclusion.
 */
export enum CheckConclusionState {
  ACTION_REQUIRED = "ACTION_REQUIRED",
  CANCELLED = "CANCELLED",
  FAILURE = "FAILURE",
  NEUTRAL = "NEUTRAL",
  SKIPPED = "SKIPPED",
  STALE = "STALE",
  STARTUP_FAILURE = "STARTUP_FAILURE",
  SUCCESS = "SUCCESS",
  TIMED_OUT = "TIMED_OUT",
}

/**
 * The possible states for a check suite or run status.
 */
export enum CheckStatusState {
  COMPLETED = "COMPLETED",
  IN_PROGRESS = "IN_PROGRESS",
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  REQUESTED = "REQUESTED",
  WAITING = "WAITING",
}

/**
 * A comment author association with repository.
 */
export enum CommentAuthorAssociation {
  COLLABORATOR = "COLLABORATOR",
  CONTRIBUTOR = "CONTRIBUTOR",
  FIRST_TIMER = "FIRST_TIMER",
  FIRST_TIME_CONTRIBUTOR = "FIRST_TIME_CONTRIBUTOR",
  MANNEQUIN = "MANNEQUIN",
  MEMBER = "MEMBER",
  NONE = "NONE",
  OWNER = "OWNER",
}

/**
 * Whether or not a PullRequest can be merged.
 */
export enum MergeableState {
  CONFLICTING = "CONFLICTING",
  MERGEABLE = "MERGEABLE",
  UNKNOWN = "UNKNOWN",
}

/**
 * The possible states of a pull request review.
 */
export enum PullRequestReviewState {
  APPROVED = "APPROVED",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
  COMMENTED = "COMMENTED",
  DISMISSED = "DISMISSED",
  PENDING = "PENDING",
}

/**
 * The possible states of a pull request.
 */
export enum PullRequestState {
  CLOSED = "CLOSED",
  MERGED = "MERGED",
  OPEN = "OPEN",
}

/**
 * The possible commit status states.
 */
export enum StatusState {
  ERROR = "ERROR",
  EXPECTED = "EXPECTED",
  FAILURE = "FAILURE",
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
}

//==============================================================
// END Enums and Input Objects
//==============================================================
