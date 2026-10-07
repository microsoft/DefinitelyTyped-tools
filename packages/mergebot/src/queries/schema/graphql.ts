/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** The possible states for a check suite or run conclusion. */
export enum CheckConclusionState {
  /** The check suite or run requires action. */
  ActionRequired = 'ACTION_REQUIRED',
  /** The check suite or run has been cancelled. */
  Cancelled = 'CANCELLED',
  /** The check suite or run has failed. */
  Failure = 'FAILURE',
  /** The check suite or run was neutral. */
  Neutral = 'NEUTRAL',
  /** The check suite or run was skipped. */
  Skipped = 'SKIPPED',
  /** The check suite or run was marked stale by GitHub. Only GitHub can use this conclusion. */
  Stale = 'STALE',
  /** The check suite or run has failed at startup. */
  StartupFailure = 'STARTUP_FAILURE',
  /** The check suite or run has succeeded. */
  Success = 'SUCCESS',
  /** The check suite or run has timed out. */
  TimedOut = 'TIMED_OUT'
}

/** The possible states for a check suite or run status. */
export enum CheckStatusState {
  /** The check suite or run has been completed. */
  Completed = 'COMPLETED',
  /** The check suite or run is in progress. */
  InProgress = 'IN_PROGRESS',
  /** The check suite or run is in pending state. */
  Pending = 'PENDING',
  /** The check suite or run has been queued. */
  Queued = 'QUEUED',
  /** The check suite or run has been requested. */
  Requested = 'REQUESTED',
  /** The check suite or run is in waiting state. */
  Waiting = 'WAITING'
}

/** A comment author association with repository. */
export enum CommentAuthorAssociation {
  /** Author has been invited to collaborate on the repository. */
  Collaborator = 'COLLABORATOR',
  /** Author has previously committed to the repository. */
  Contributor = 'CONTRIBUTOR',
  /** Author has not previously committed to GitHub. */
  FirstTimer = 'FIRST_TIMER',
  /** Author has not previously committed to the repository. */
  FirstTimeContributor = 'FIRST_TIME_CONTRIBUTOR',
  /** Author is a placeholder for an unclaimed user. */
  Mannequin = 'MANNEQUIN',
  /** Author is a member of the organization that owns the repository. */
  Member = 'MEMBER',
  /** Author has no association with the repository. */
  None = 'NONE',
  /** Author is the owner of the repository. */
  Owner = 'OWNER'
}

/** Whether or not a PullRequest can be merged. */
export enum MergeableState {
  /** The pull request cannot be merged due to merge conflicts. */
  Conflicting = 'CONFLICTING',
  /** The pull request can be merged. */
  Mergeable = 'MERGEABLE',
  /** The mergeability of the pull request is still being calculated. */
  Unknown = 'UNKNOWN'
}

/** The possible states of a pull request review. */
export enum PullRequestReviewState {
  /** A review allowing the pull request to merge. */
  Approved = 'APPROVED',
  /** A review blocking the pull request from merging. */
  ChangesRequested = 'CHANGES_REQUESTED',
  /** An informational review. */
  Commented = 'COMMENTED',
  /** A review that has been dismissed. */
  Dismissed = 'DISMISSED',
  /** A review that has not yet been submitted. */
  Pending = 'PENDING'
}

/** The possible states of a pull request. */
export enum PullRequestState {
  /** A pull request that has been closed without being merged. */
  Closed = 'CLOSED',
  /** A pull request that has been closed by being merged. */
  Merged = 'MERGED',
  /** A pull request that is still open. */
  Open = 'OPEN'
}

/** The possible commit status states. */
export enum StatusState {
  /** Status is errored. */
  Error = 'ERROR',
  /** Status is expected. */
  Expected = 'EXPECTED',
  /** Status is failing. */
  Failure = 'FAILURE',
  /** Status is pending. */
  Pending = 'PENDING',
  /** Status is successful. */
  Success = 'SUCCESS'
}

export type GetPrForSha1QueryVariables = Exact<{
  query: string;
}>;


export type GetPrForSha1Query = { __typename: 'Query', search: { __typename: 'SearchResultItemConnection', nodes: Array<
      | { __typename: 'App' }
      | { __typename: 'Discussion' }
      | { __typename: 'Issue' }
      | { __typename: 'MarketplaceListing' }
      | { __typename: 'Organization' }
      | { __typename: 'PullRequest', title: string, number: number, closed: boolean }
      | { __typename: 'Repository' }
      | { __typename: 'User' }
     | null> | null } };

export type GetAllOpenPRsQueryVariables = Exact<{
  endCursor?: string | null | undefined;
}>;


export type GetAllOpenPRsQuery = { __typename: 'Query', repository: { __typename: 'Repository', id: string, pullRequests: { __typename: 'PullRequestConnection', nodes: Array<{ __typename: 'PullRequest', number: number } | null> | null, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } } | null };

export type CardIdToPrQueryVariables = Exact<{
  id: string | number;
}>;


export type CardIdToPrQuery = { __typename: 'Query', node:
    | { __typename: 'AddedToMergeQueueEvent' }
    | { __typename: 'AddedToProjectEvent' }
    | { __typename: 'App' }
    | { __typename: 'AssignedEvent' }
    | { __typename: 'AutoMergeDisabledEvent' }
    | { __typename: 'AutoMergeEnabledEvent' }
    | { __typename: 'AutoRebaseEnabledEvent' }
    | { __typename: 'AutoSquashEnabledEvent' }
    | { __typename: 'AutomaticBaseChangeFailedEvent' }
    | { __typename: 'AutomaticBaseChangeSucceededEvent' }
    | { __typename: 'BaseRefChangedEvent' }
    | { __typename: 'BaseRefDeletedEvent' }
    | { __typename: 'BaseRefForcePushedEvent' }
    | { __typename: 'Blob' }
    | { __typename: 'Bot' }
    | { __typename: 'BranchProtectionRule' }
    | { __typename: 'BypassForcePushAllowance' }
    | { __typename: 'BypassPullRequestAllowance' }
    | { __typename: 'CWE' }
    | { __typename: 'CheckRun' }
    | { __typename: 'CheckSuite' }
    | { __typename: 'ClosedEvent' }
    | { __typename: 'CodeOfConduct' }
    | { __typename: 'CommentDeletedEvent' }
    | { __typename: 'Commit' }
    | { __typename: 'CommitComment' }
    | { __typename: 'CommitCommentThread' }
    | { __typename: 'Comparison' }
    | { __typename: 'ConnectedEvent' }
    | { __typename: 'ConvertToDraftEvent' }
    | { __typename: 'ConvertedNoteToIssueEvent' }
    | { __typename: 'ConvertedToDiscussionEvent' }
    | { __typename: 'CrossReferencedEvent' }
    | { __typename: 'DemilestonedEvent' }
    | { __typename: 'DependencyGraphManifest' }
    | { __typename: 'DeployKey' }
    | { __typename: 'DeployedEvent' }
    | { __typename: 'Deployment' }
    | { __typename: 'DeploymentEnvironmentChangedEvent' }
    | { __typename: 'DeploymentReview' }
    | { __typename: 'DeploymentStatus' }
    | { __typename: 'DisconnectedEvent' }
    | { __typename: 'Discussion' }
    | { __typename: 'DiscussionCategory' }
    | { __typename: 'DiscussionComment' }
    | { __typename: 'DiscussionPoll' }
    | { __typename: 'DiscussionPollOption' }
    | { __typename: 'DraftIssue' }
    | { __typename: 'Enterprise' }
    | { __typename: 'EnterpriseAdministratorInvitation' }
    | { __typename: 'EnterpriseIdentityProvider' }
    | { __typename: 'EnterpriseMemberInvitation' }
    | { __typename: 'EnterpriseRepositoryInfo' }
    | { __typename: 'EnterpriseServerInstallation' }
    | { __typename: 'EnterpriseServerUserAccount' }
    | { __typename: 'EnterpriseServerUserAccountEmail' }
    | { __typename: 'EnterpriseServerUserAccountsUpload' }
    | { __typename: 'EnterpriseUserAccount' }
    | { __typename: 'Environment' }
    | { __typename: 'ExternalIdentity' }
    | { __typename: 'Gist' }
    | { __typename: 'GistComment' }
    | { __typename: 'HeadRefDeletedEvent' }
    | { __typename: 'HeadRefForcePushedEvent' }
    | { __typename: 'HeadRefRestoredEvent' }
    | { __typename: 'IpAllowListEntry' }
    | { __typename: 'Issue' }
    | { __typename: 'IssueComment' }
    | { __typename: 'Label' }
    | { __typename: 'LabeledEvent' }
    | { __typename: 'Language' }
    | { __typename: 'License' }
    | { __typename: 'LinkedBranch' }
    | { __typename: 'LockedEvent' }
    | { __typename: 'Mannequin' }
    | { __typename: 'MarkedAsDuplicateEvent' }
    | { __typename: 'MarketplaceCategory' }
    | { __typename: 'MarketplaceListing' }
    | { __typename: 'MemberFeatureRequestNotification' }
    | { __typename: 'MembersCanDeleteReposClearAuditEntry' }
    | { __typename: 'MembersCanDeleteReposDisableAuditEntry' }
    | { __typename: 'MembersCanDeleteReposEnableAuditEntry' }
    | { __typename: 'MentionedEvent' }
    | { __typename: 'MergeQueue' }
    | { __typename: 'MergeQueueEntry' }
    | { __typename: 'MergedEvent' }
    | { __typename: 'MigrationSource' }
    | { __typename: 'Milestone' }
    | { __typename: 'MilestonedEvent' }
    | { __typename: 'MovedColumnsInProjectEvent' }
    | { __typename: 'OIDCProvider' }
    | { __typename: 'OauthApplicationCreateAuditEntry' }
    | { __typename: 'OrgAddBillingManagerAuditEntry' }
    | { __typename: 'OrgAddMemberAuditEntry' }
    | { __typename: 'OrgBlockUserAuditEntry' }
    | { __typename: 'OrgConfigDisableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'OrgConfigEnableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'OrgCreateAuditEntry' }
    | { __typename: 'OrgDisableOauthAppRestrictionsAuditEntry' }
    | { __typename: 'OrgDisableSamlAuditEntry' }
    | { __typename: 'OrgDisableTwoFactorRequirementAuditEntry' }
    | { __typename: 'OrgEnableOauthAppRestrictionsAuditEntry' }
    | { __typename: 'OrgEnableSamlAuditEntry' }
    | { __typename: 'OrgEnableTwoFactorRequirementAuditEntry' }
    | { __typename: 'OrgInviteMemberAuditEntry' }
    | { __typename: 'OrgInviteToBusinessAuditEntry' }
    | { __typename: 'OrgOauthAppAccessApprovedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessBlockedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessDeniedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessRequestedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessUnblockedAuditEntry' }
    | { __typename: 'OrgRemoveBillingManagerAuditEntry' }
    | { __typename: 'OrgRemoveMemberAuditEntry' }
    | { __typename: 'OrgRemoveOutsideCollaboratorAuditEntry' }
    | { __typename: 'OrgRestoreMemberAuditEntry' }
    | { __typename: 'OrgUnblockUserAuditEntry' }
    | { __typename: 'OrgUpdateDefaultRepositoryPermissionAuditEntry' }
    | { __typename: 'OrgUpdateMemberAuditEntry' }
    | { __typename: 'OrgUpdateMemberRepositoryCreationPermissionAuditEntry' }
    | { __typename: 'OrgUpdateMemberRepositoryInvitationPermissionAuditEntry' }
    | { __typename: 'Organization' }
    | { __typename: 'OrganizationIdentityProvider' }
    | { __typename: 'OrganizationInvitation' }
    | { __typename: 'OrganizationMigration' }
    | { __typename: 'Package' }
    | { __typename: 'PackageFile' }
    | { __typename: 'PackageTag' }
    | { __typename: 'PackageVersion' }
    | { __typename: 'ParentIssueAddedEvent' }
    | { __typename: 'ParentIssueRemovedEvent' }
    | { __typename: 'PinnedDiscussion' }
    | { __typename: 'PinnedEnvironment' }
    | { __typename: 'PinnedEvent' }
    | { __typename: 'PinnedIssue' }
    | { __typename: 'PrivateRepositoryForkingDisableAuditEntry' }
    | { __typename: 'PrivateRepositoryForkingEnableAuditEntry' }
    | { __typename: 'Project' }
    | { __typename: 'ProjectCard' }
    | { __typename: 'ProjectColumn' }
    | { __typename: 'ProjectV2' }
    | { __typename: 'ProjectV2Field' }
    | { __typename: 'ProjectV2Item', content:
        | { __typename: 'DraftIssue' }
        | { __typename: 'Issue' }
        | { __typename: 'PullRequest', state: PullRequestState, number: number }
       | null }
    | { __typename: 'ProjectV2ItemFieldDateValue' }
    | { __typename: 'ProjectV2ItemFieldIterationValue' }
    | { __typename: 'ProjectV2ItemFieldNumberValue' }
    | { __typename: 'ProjectV2ItemFieldSingleSelectValue' }
    | { __typename: 'ProjectV2ItemFieldTextValue' }
    | { __typename: 'ProjectV2IterationField' }
    | { __typename: 'ProjectV2SingleSelectField' }
    | { __typename: 'ProjectV2StatusUpdate' }
    | { __typename: 'ProjectV2View' }
    | { __typename: 'ProjectV2Workflow' }
    | { __typename: 'PublicKey' }
    | { __typename: 'PullRequest' }
    | { __typename: 'PullRequestCommit' }
    | { __typename: 'PullRequestCommitCommentThread' }
    | { __typename: 'PullRequestReview' }
    | { __typename: 'PullRequestReviewComment' }
    | { __typename: 'PullRequestReviewThread' }
    | { __typename: 'PullRequestThread' }
    | { __typename: 'Push' }
    | { __typename: 'PushAllowance' }
    | { __typename: 'Query' }
    | { __typename: 'Reaction' }
    | { __typename: 'ReadyForReviewEvent' }
    | { __typename: 'Ref' }
    | { __typename: 'ReferencedEvent' }
    | { __typename: 'Release' }
    | { __typename: 'ReleaseAsset' }
    | { __typename: 'RemovedFromMergeQueueEvent' }
    | { __typename: 'RemovedFromProjectEvent' }
    | { __typename: 'RenamedTitleEvent' }
    | { __typename: 'ReopenedEvent' }
    | { __typename: 'RepoAccessAuditEntry' }
    | { __typename: 'RepoAddMemberAuditEntry' }
    | { __typename: 'RepoAddTopicAuditEntry' }
    | { __typename: 'RepoArchivedAuditEntry' }
    | { __typename: 'RepoChangeMergeSettingAuditEntry' }
    | { __typename: 'RepoConfigDisableAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoConfigDisableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigDisableContributorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigDisableSockpuppetDisallowedAuditEntry' }
    | { __typename: 'RepoConfigEnableAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoConfigEnableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigEnableContributorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigEnableSockpuppetDisallowedAuditEntry' }
    | { __typename: 'RepoConfigLockAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoConfigUnlockAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoCreateAuditEntry' }
    | { __typename: 'RepoDestroyAuditEntry' }
    | { __typename: 'RepoRemoveMemberAuditEntry' }
    | { __typename: 'RepoRemoveTopicAuditEntry' }
    | { __typename: 'Repository' }
    | { __typename: 'RepositoryInvitation' }
    | { __typename: 'RepositoryMigration' }
    | { __typename: 'RepositoryRule' }
    | { __typename: 'RepositoryRuleset' }
    | { __typename: 'RepositoryRulesetBypassActor' }
    | { __typename: 'RepositoryTopic' }
    | { __typename: 'RepositoryVisibilityChangeDisableAuditEntry' }
    | { __typename: 'RepositoryVisibilityChangeEnableAuditEntry' }
    | { __typename: 'RepositoryVulnerabilityAlert' }
    | { __typename: 'ReviewDismissalAllowance' }
    | { __typename: 'ReviewDismissedEvent' }
    | { __typename: 'ReviewRequest' }
    | { __typename: 'ReviewRequestRemovedEvent' }
    | { __typename: 'ReviewRequestedEvent' }
    | { __typename: 'SavedReply' }
    | { __typename: 'SecurityAdvisory' }
    | { __typename: 'SponsorsActivity' }
    | { __typename: 'SponsorsListing' }
    | { __typename: 'SponsorsListingFeaturedItem' }
    | { __typename: 'SponsorsTier' }
    | { __typename: 'Sponsorship' }
    | { __typename: 'SponsorshipNewsletter' }
    | { __typename: 'Status' }
    | { __typename: 'StatusCheckRollup' }
    | { __typename: 'StatusContext' }
    | { __typename: 'SubIssueAddedEvent' }
    | { __typename: 'SubIssueRemovedEvent' }
    | { __typename: 'SubscribedEvent' }
    | { __typename: 'Tag' }
    | { __typename: 'Team' }
    | { __typename: 'TeamAddMemberAuditEntry' }
    | { __typename: 'TeamAddRepositoryAuditEntry' }
    | { __typename: 'TeamChangeParentTeamAuditEntry' }
    | { __typename: 'TeamDiscussion' }
    | { __typename: 'TeamDiscussionComment' }
    | { __typename: 'TeamRemoveMemberAuditEntry' }
    | { __typename: 'TeamRemoveRepositoryAuditEntry' }
    | { __typename: 'Topic' }
    | { __typename: 'TransferredEvent' }
    | { __typename: 'Tree' }
    | { __typename: 'UnassignedEvent' }
    | { __typename: 'UnlabeledEvent' }
    | { __typename: 'UnlockedEvent' }
    | { __typename: 'UnmarkedAsDuplicateEvent' }
    | { __typename: 'UnpinnedEvent' }
    | { __typename: 'UnsubscribedEvent' }
    | { __typename: 'User' }
    | { __typename: 'UserBlockedEvent' }
    | { __typename: 'UserContentEdit' }
    | { __typename: 'UserList' }
    | { __typename: 'UserNamespaceRepository' }
    | { __typename: 'UserStatus' }
    | { __typename: 'VerifiableDomain' }
    | { __typename: 'Workflow' }
    | { __typename: 'WorkflowRun' }
    | { __typename: 'WorkflowRunFile' }
   | null };

export type GetLabelByNameQueryVariables = Exact<{
  name: string;
}>;


export type GetLabelByNameQuery = { __typename: 'Query', repository: { __typename: 'Repository', id: string, name: string, labels: { __typename: 'LabelConnection', nodes: Array<{ __typename: 'Label', id: string, name: string } | null> | null } | null } | null };

export type GetDiscussionCommentsQueryVariables = Exact<{
  discussionNumber: number;
}>;


export type GetDiscussionCommentsQuery = { __typename: 'Query', repository: { __typename: 'Repository', name: string, discussion: { __typename: 'Discussion', comments: { __typename: 'DiscussionCommentConnection', nodes: Array<{ __typename: 'DiscussionComment', id: string, body: string, author:
            | { __typename: 'Bot', login: string }
            | { __typename: 'EnterpriseUserAccount', login: string }
            | { __typename: 'Mannequin', login: string }
            | { __typename: 'Organization', login: string }
            | { __typename: 'User', login: string }
           | null } | null> | null } } | null } | null };

export type GetFileContentQueryVariables = Exact<{
  owner: string;
  name: string;
  expr: string;
}>;


export type GetFileContentQuery = { __typename: 'Query', repository: { __typename: 'Repository', id: string, object:
      | { __typename: 'Blob', text: string | null, byteSize: number }
      | { __typename: 'Commit' }
      | { __typename: 'Tag' }
      | { __typename: 'Tree' }
     | null } | null };

export type GetLabelsQueryVariables = Exact<{
  endCursor?: string | null | undefined;
}>;


export type GetLabelsQuery = { __typename: 'Query', repository: { __typename: 'Repository', id: string, labels: { __typename: 'LabelConnection', nodes: Array<{ __typename: 'Label', id: string, name: string } | null> | null, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } | null } | null };

export type GetProjectColumnsQueryVariables = Exact<{
  cursor?: string | null | undefined;
}>;


export type GetProjectColumnsQuery = { __typename: 'Query', repository: { __typename: 'Repository', id: string, projectV2: { __typename: 'ProjectV2', id: string, fields: { __typename: 'ProjectV2FieldConfigurationConnection', pageInfo: { __typename: 'PageInfo', startCursor: string | null, hasNextPage: boolean, endCursor: string | null }, nodes: Array<
          | { __typename: 'ProjectV2Field' }
          | { __typename: 'ProjectV2IterationField' }
          | { __typename: 'ProjectV2SingleSelectField', name: string, options: Array<{ __typename: 'ProjectV2SingleSelectFieldOption', id: string, name: string }> }
         | null> | null } } | null } | null };

export type PrQueryVariables = Exact<{
  prNumber: number;
}>;


export type PrQuery = { __typename: 'Query', repository: { __typename: 'Repository', id: string, pullRequest: { __typename: 'PullRequest', id: string, title: string, createdAt: string, authorAssociation: CommentAuthorAssociation, isDraft: boolean, mergeable: MergeableState, number: number, state: PullRequestState, headRefOid: string, baseRefOid: string, changedFiles: number, additions: number, deletions: number, author:
        | { __typename: 'Bot', login: string }
        | { __typename: 'EnterpriseUserAccount', login: string }
        | { __typename: 'Mannequin', login: string }
        | { __typename: 'Organization', login: string }
        | { __typename: 'User', login: string }
       | null, baseRef: { __typename: 'Ref', name: string } | null, labels: { __typename: 'LabelConnection', nodes: Array<{ __typename: 'Label', name: string } | null> | null } | null, commitIds: { __typename: 'PullRequestCommitConnection', totalCount: number, nodes: Array<{ __typename: 'PullRequestCommit', commit: { __typename: 'Commit', oid: string, parents: { __typename: 'CommitConnection', nodes: Array<{ __typename: 'Commit', oid: string } | null> | null } } } | null> | null }, timelineItems: { __typename: 'PullRequestTimelineItemsConnection', nodes: Array<
          | { __typename: 'AddedToMergeQueueEvent' }
          | { __typename: 'AddedToProjectEvent' }
          | { __typename: 'AssignedEvent' }
          | { __typename: 'AutoMergeDisabledEvent' }
          | { __typename: 'AutoMergeEnabledEvent' }
          | { __typename: 'AutoRebaseEnabledEvent' }
          | { __typename: 'AutoSquashEnabledEvent' }
          | { __typename: 'AutomaticBaseChangeFailedEvent' }
          | { __typename: 'AutomaticBaseChangeSucceededEvent' }
          | { __typename: 'BaseRefChangedEvent' }
          | { __typename: 'BaseRefDeletedEvent' }
          | { __typename: 'BaseRefForcePushedEvent' }
          | { __typename: 'ClosedEvent' }
          | { __typename: 'CommentDeletedEvent' }
          | { __typename: 'ConnectedEvent' }
          | { __typename: 'ConvertToDraftEvent' }
          | { __typename: 'ConvertedNoteToIssueEvent' }
          | { __typename: 'ConvertedToDiscussionEvent' }
          | { __typename: 'CrossReferencedEvent' }
          | { __typename: 'DemilestonedEvent' }
          | { __typename: 'DeployedEvent' }
          | { __typename: 'DeploymentEnvironmentChangedEvent' }
          | { __typename: 'DisconnectedEvent' }
          | { __typename: 'HeadRefDeletedEvent' }
          | { __typename: 'HeadRefForcePushedEvent', createdAt: string, actor:
              | { __typename: 'Bot', login: string }
              | { __typename: 'EnterpriseUserAccount', login: string }
              | { __typename: 'Mannequin', login: string }
              | { __typename: 'Organization', login: string }
              | { __typename: 'User', login: string }
             | null }
          | { __typename: 'HeadRefRestoredEvent' }
          | { __typename: 'IssueComment' }
          | { __typename: 'LabeledEvent' }
          | { __typename: 'LockedEvent' }
          | { __typename: 'MarkedAsDuplicateEvent' }
          | { __typename: 'MentionedEvent' }
          | { __typename: 'MergedEvent' }
          | { __typename: 'MilestonedEvent' }
          | { __typename: 'MovedColumnsInProjectEvent', createdAt: string, projectColumnName: string, actor:
              | { __typename: 'Bot', login: string }
              | { __typename: 'EnterpriseUserAccount', login: string }
              | { __typename: 'Mannequin', login: string }
              | { __typename: 'Organization', login: string }
              | { __typename: 'User', login: string }
             | null }
          | { __typename: 'ParentIssueAddedEvent' }
          | { __typename: 'ParentIssueRemovedEvent' }
          | { __typename: 'PinnedEvent' }
          | { __typename: 'PullRequestCommit' }
          | { __typename: 'PullRequestCommitCommentThread' }
          | { __typename: 'PullRequestReview' }
          | { __typename: 'PullRequestReviewThread' }
          | { __typename: 'PullRequestRevisionMarker' }
          | { __typename: 'ReadyForReviewEvent', createdAt: string }
          | { __typename: 'ReferencedEvent' }
          | { __typename: 'RemovedFromMergeQueueEvent' }
          | { __typename: 'RemovedFromProjectEvent' }
          | { __typename: 'RenamedTitleEvent' }
          | { __typename: 'ReopenedEvent', createdAt: string }
          | { __typename: 'ReviewDismissedEvent' }
          | { __typename: 'ReviewRequestRemovedEvent' }
          | { __typename: 'ReviewRequestedEvent' }
          | { __typename: 'SubIssueAddedEvent' }
          | { __typename: 'SubIssueRemovedEvent' }
          | { __typename: 'SubscribedEvent' }
          | { __typename: 'TransferredEvent' }
          | { __typename: 'UnassignedEvent' }
          | { __typename: 'UnlabeledEvent' }
          | { __typename: 'UnlockedEvent' }
          | { __typename: 'UnmarkedAsDuplicateEvent' }
          | { __typename: 'UnpinnedEvent' }
          | { __typename: 'UnsubscribedEvent' }
          | { __typename: 'UserBlockedEvent' }
         | null> | null }, reviews: { __typename: 'PullRequestReviewConnection', totalCount: number, nodes: Array<{ __typename: 'PullRequestReview', authorAssociation: CommentAuthorAssociation, state: PullRequestReviewState, submittedAt: string | null, url: string, author:
            | { __typename: 'Bot', login: string }
            | { __typename: 'EnterpriseUserAccount', login: string }
            | { __typename: 'Mannequin', login: string }
            | { __typename: 'Organization', login: string }
            | { __typename: 'User', login: string }
           | null, commit: { __typename: 'Commit', oid: string } | null, comments: { __typename: 'PullRequestReviewCommentConnection', nodes: Array<{ __typename: 'PullRequestReviewComment', createdAt: string, author:
                | { __typename: 'Bot', login: string }
                | { __typename: 'EnterpriseUserAccount', login: string }
                | { __typename: 'Mannequin', login: string }
                | { __typename: 'Organization', login: string }
                | { __typename: 'User', login: string }
               | null } | null> | null } } | null> | null } | null, commits: { __typename: 'PullRequestCommitConnection', totalCount: number, nodes: Array<{ __typename: 'PullRequestCommit', commit: { __typename: 'Commit', authoredDate: string, committedDate: string, pushedDate: string | null, oid: string, checkSuites: { __typename: 'CheckSuiteConnection', nodes: Array<{ __typename: 'CheckSuite', databaseId: number | null, conclusion: CheckConclusionState | null, resourcePath: string, status: CheckStatusState, url: string, createdAt: string, app: { __typename: 'App', name: string } | null, checkRuns: { __typename: 'CheckRunConnection', nodes: Array<{ __typename: 'CheckRun', title: string | null } | null> | null } | null, workflowRun: { __typename: 'WorkflowRun', databaseId: number | null, file: { __typename: 'WorkflowRunFile', path: string } | null } | null } | null> | null } | null, status: { __typename: 'Status', state: StatusState, contexts: Array<{ __typename: 'StatusContext', state: StatusState, description: string | null, targetUrl: string | null, creator:
                  | { __typename: 'Bot', login: string }
                  | { __typename: 'EnterpriseUserAccount', login: string }
                  | { __typename: 'Mannequin', login: string }
                  | { __typename: 'Organization', login: string }
                  | { __typename: 'User', login: string }
                 | null }> } | null } } | null> | null }, comments: { __typename: 'IssueCommentConnection', totalCount: number, nodes: Array<{ __typename: 'IssueComment', id: string, authorAssociation: CommentAuthorAssociation, databaseId: number | null, body: string, createdAt: string, author:
            | { __typename: 'Bot', login: string }
            | { __typename: 'EnterpriseUserAccount', login: string }
            | { __typename: 'Mannequin', login: string }
            | { __typename: 'Organization', login: string }
            | { __typename: 'User', login: string }
           | null, reactions: { __typename: 'ReactionConnection', nodes: Array<{ __typename: 'Reaction', user: { __typename: 'User', login: string } | null } | null> | null } } | null> | null }, files: { __typename: 'PullRequestChangedFileConnection', totalCount: number, nodes: Array<{ __typename: 'PullRequestChangedFile', path: string, additions: number, deletions: number } | null> | null, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } | null, projectItems: { __typename: 'ProjectV2ItemConnection', nodes: Array<{ __typename: 'ProjectV2Item', id: string, updatedAt: string, project: { __typename: 'ProjectV2', id: string, number: number }, fieldValueByName:
            | { __typename: 'ProjectV2ItemFieldDateValue' }
            | { __typename: 'ProjectV2ItemFieldIterationValue' }
            | { __typename: 'ProjectV2ItemFieldLabelValue' }
            | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
            | { __typename: 'ProjectV2ItemFieldNumberValue' }
            | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
            | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
            | { __typename: 'ProjectV2ItemFieldReviewerValue' }
            | { __typename: 'ProjectV2ItemFieldSingleSelectValue', name: string | null, field:
                | { __typename: 'ProjectV2Field' }
                | { __typename: 'ProjectV2IterationField' }
                | { __typename: 'ProjectV2SingleSelectField', id: string }
               }
            | { __typename: 'ProjectV2ItemFieldTextValue' }
            | { __typename: 'ProjectV2ItemFieldUserValue' }
           | null } | null> | null } } | null } | null };

export type PrFilesQueryVariables = Exact<{
  prNumber: number;
  endCursor?: string | null | undefined;
}>;


export type PrFilesQuery = { __typename: 'Query', repository: { __typename: 'Repository', pullRequest: { __typename: 'PullRequest', files: { __typename: 'PullRequestChangedFileConnection', totalCount: number, nodes: Array<{ __typename: 'PullRequestChangedFile', path: string, additions: number, deletions: number } | null> | null, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } | null } | null } | null };

export type GetProjectBoardCardsQueryVariables = Exact<{
  cursor?: string | null | undefined;
}>;


export type GetProjectBoardCardsQuery = { __typename: 'Query', repository: { __typename: 'Repository', projectV2: { __typename: 'ProjectV2', id: string, items: { __typename: 'ProjectV2ItemConnection', totalCount: number, pageInfo: { __typename: 'PageInfo', startCursor: string | null, hasNextPage: boolean, endCursor: string | null }, nodes: Array<{ __typename: 'ProjectV2Item', id: string, updatedAt: string, fieldValueByName:
            | { __typename: 'ProjectV2ItemFieldDateValue' }
            | { __typename: 'ProjectV2ItemFieldIterationValue' }
            | { __typename: 'ProjectV2ItemFieldLabelValue' }
            | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
            | { __typename: 'ProjectV2ItemFieldNumberValue' }
            | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
            | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
            | { __typename: 'ProjectV2ItemFieldReviewerValue' }
            | { __typename: 'ProjectV2ItemFieldSingleSelectValue', name: string | null }
            | { __typename: 'ProjectV2ItemFieldTextValue' }
            | { __typename: 'ProjectV2ItemFieldUserValue' }
           | null } | null> | null } } | null } | null };


export const GetPrForSha1Document = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPRForSHA1"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ISSUE"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PullRequest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"closed"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPrForSha1Query, GetPrForSha1QueryVariables>;
export const GetAllOpenPRsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAllOpenPRs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endCursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pullRequests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"states"},"value":{"kind":"EnumValue","value":"OPEN"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"field"},"value":{"kind":"EnumValue","value":"UPDATED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"DESC"}}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endCursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetAllOpenPRsQuery, GetAllOpenPRsQueryVariables>;
export const CardIdToPrDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CardIdToPr"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProjectV2Item"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"content"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PullRequest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"number"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<CardIdToPrQuery, CardIdToPrQueryVariables>;
export const GetLabelByNameDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLabelByName"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetLabelByNameQuery, GetLabelByNameQueryVariables>;
export const GetDiscussionCommentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDiscussionComments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"discussionNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"discussion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"number"},"value":{"kind":"Variable","name":{"kind":"Name","value":"discussionNumber"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetDiscussionCommentsQuery, GetDiscussionCommentsQueryVariables>;
export const GetFileContentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFileContent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"owner"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"expr"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"Variable","name":{"kind":"Name","value":"owner"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"object"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expression"},"value":{"kind":"Variable","name":{"kind":"Name","value":"expr"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Blob"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"byteSize"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetFileContentQuery, GetFileContentQueryVariables>;
export const GetLabelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLabels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endCursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endCursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetLabelsQuery, GetLabelsQueryVariables>;
export const GetProjectColumnsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetProjectColumns"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectV2"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"number"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fields"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProjectV2SingleSelectField"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetProjectColumnsQuery, GetProjectColumnsQueryVariables>;
export const PrDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PR"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pullRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"number"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prNumber"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authorAssociation"}},{"kind":"Field","name":{"kind":"Name","value":"baseRef"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}},{"kind":"Field","name":{"kind":"Name","value":"mergeable"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"headRefOid"}},{"kind":"Field","name":{"kind":"Name","value":"baseRefOid"}},{"kind":"Field","name":{"kind":"Name","value":"changedFiles"}},{"kind":"Field","name":{"kind":"Name","value":"additions"}},{"kind":"Field","name":{"kind":"Name","value":"deletions"}},{"kind":"Field","alias":{"kind":"Name","value":"commitIds"},"name":{"kind":"Name","value":"commits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"oid"}},{"kind":"Field","name":{"kind":"Name","value":"parents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"oid"}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"timelineItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"itemTypes"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"REOPENED_EVENT"},{"kind":"EnumValue","value":"READY_FOR_REVIEW_EVENT"},{"kind":"EnumValue","value":"MOVED_COLUMNS_IN_PROJECT_EVENT"},{"kind":"EnumValue","value":"HEAD_REF_FORCE_PUSHED_EVENT"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReopenedEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReadyForReviewEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MovedColumnsInProjectEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"actor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"projectColumnName"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"HeadRefForcePushedEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"actor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"reviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"commit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"oid"}}]}},{"kind":"Field","name":{"kind":"Name","value":"comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"authorAssociation"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"commits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkSuites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"databaseId"}},{"kind":"Field","name":{"kind":"Name","value":"app"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"conclusion"}},{"kind":"Field","name":{"kind":"Name","value":"resourcePath"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"checkRuns"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"workflowRun"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"databaseId"}},{"kind":"Field","name":{"kind":"Name","value":"file"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"status"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"contexts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"targetUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"authoredDate"}},{"kind":"Field","name":{"kind":"Name","value":"committedDate"}},{"kind":"Field","name":{"kind":"Name","value":"pushedDate"}},{"kind":"Field","name":{"kind":"Name","value":"oid"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authorAssociation"}},{"kind":"Field","name":{"kind":"Name","value":"databaseId"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"reactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"EnumValue","value":"THUMBS_UP"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"files"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"additions"}},{"kind":"Field","name":{"kind":"Name","value":"deletions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"projectItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fieldValueByName"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"Status","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProjectV2ItemFieldSingleSelectValue"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"field"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProjectV2SingleSelectField"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<PrQuery, PrQueryVariables>;
export const PrFilesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PRFiles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endCursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pullRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"number"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prNumber"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"files"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endCursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"additions"}},{"kind":"Field","name":{"kind":"Name","value":"deletions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<PrFilesQuery, PrFilesQueryVariables>;
export const GetProjectBoardCardsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetProjectBoardCards"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repository"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"owner"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"DefinitelyTyped","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectV2"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"number"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fieldValueByName"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"StringValue","value":"Status","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProjectV2ItemFieldSingleSelectValue"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetProjectBoardCardsQuery, GetProjectBoardCardsQueryVariables>;