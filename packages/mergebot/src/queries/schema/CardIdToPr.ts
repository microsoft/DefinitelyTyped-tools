/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { PullRequestState } from "./graphql-global-types";

// ====================================================
// GraphQL query operation: CardIdToPr
// ====================================================

export interface CardIdToPr_node_AddedToMergeQueueEvent {
  __typename: "AddedToMergeQueueEvent" | "AddedToProjectEvent" | "App" | "AssignedEvent" | "AutoMergeDisabledEvent" | "AutoMergeEnabledEvent" | "AutoRebaseEnabledEvent" | "AutoSquashEnabledEvent" | "AutomaticBaseChangeFailedEvent" | "AutomaticBaseChangeSucceededEvent" | "BaseRefChangedEvent" | "BaseRefDeletedEvent" | "BaseRefForcePushedEvent" | "Blob" | "Bot" | "BranchProtectionRule" | "BypassForcePushAllowance" | "BypassPullRequestAllowance" | "CWE" | "CheckRun" | "CheckSuite" | "ClosedEvent" | "CodeOfConduct" | "CommentDeletedEvent" | "Commit" | "CommitComment" | "CommitCommentThread" | "Comparison" | "ConnectedEvent" | "ConvertToDraftEvent" | "ConvertedNoteToIssueEvent" | "ConvertedToDiscussionEvent" | "CrossReferencedEvent" | "DemilestonedEvent" | "DeployKey" | "DeployedEvent" | "Deployment" | "DeploymentEnvironmentChangedEvent" | "DeploymentReview" | "DeploymentStatus" | "DisconnectedEvent" | "Discussion" | "DiscussionCategory" | "DiscussionComment" | "DiscussionPoll" | "DiscussionPollOption" | "DraftIssue" | "Enterprise" | "EnterpriseAdministratorInvitation" | "EnterpriseIdentityProvider" | "EnterpriseRepositoryInfo" | "EnterpriseServerInstallation" | "EnterpriseServerUserAccount" | "EnterpriseServerUserAccountEmail" | "EnterpriseServerUserAccountsUpload" | "EnterpriseUserAccount" | "Environment" | "ExternalIdentity" | "Gist" | "GistComment" | "HeadRefDeletedEvent" | "HeadRefForcePushedEvent" | "HeadRefRestoredEvent" | "IpAllowListEntry" | "Issue" | "IssueComment" | "Label" | "LabeledEvent" | "Language" | "License" | "LinkedBranch" | "LockedEvent" | "Mannequin" | "MarkedAsDuplicateEvent" | "MarketplaceCategory" | "MarketplaceListing" | "MemberFeatureRequestNotification" | "MembersCanDeleteReposClearAuditEntry" | "MembersCanDeleteReposDisableAuditEntry" | "MembersCanDeleteReposEnableAuditEntry" | "MentionedEvent" | "MergeQueue" | "MergeQueueEntry" | "MergedEvent" | "MigrationSource" | "Milestone" | "MilestonedEvent" | "MovedColumnsInProjectEvent" | "NotificationThread" | "OIDCProvider" | "OauthApplicationCreateAuditEntry" | "OrgAddBillingManagerAuditEntry" | "OrgAddMemberAuditEntry" | "OrgBlockUserAuditEntry" | "OrgConfigDisableCollaboratorsOnlyAuditEntry" | "OrgConfigEnableCollaboratorsOnlyAuditEntry" | "OrgCreateAuditEntry" | "OrgDisableOauthAppRestrictionsAuditEntry" | "OrgDisableSamlAuditEntry" | "OrgDisableTwoFactorRequirementAuditEntry" | "OrgEnableOauthAppRestrictionsAuditEntry" | "OrgEnableSamlAuditEntry" | "OrgEnableTwoFactorRequirementAuditEntry" | "OrgInviteMemberAuditEntry" | "OrgInviteToBusinessAuditEntry" | "OrgOauthAppAccessApprovedAuditEntry" | "OrgOauthAppAccessBlockedAuditEntry" | "OrgOauthAppAccessDeniedAuditEntry" | "OrgOauthAppAccessRequestedAuditEntry" | "OrgOauthAppAccessUnblockedAuditEntry" | "OrgRemoveBillingManagerAuditEntry" | "OrgRemoveMemberAuditEntry" | "OrgRemoveOutsideCollaboratorAuditEntry" | "OrgRestoreMemberAuditEntry" | "OrgUnblockUserAuditEntry" | "OrgUpdateDefaultRepositoryPermissionAuditEntry" | "OrgUpdateMemberAuditEntry" | "OrgUpdateMemberRepositoryCreationPermissionAuditEntry" | "OrgUpdateMemberRepositoryInvitationPermissionAuditEntry" | "Organization" | "OrganizationIdentityProvider" | "OrganizationInvitation" | "OrganizationMigration" | "Package" | "PackageFile" | "PackageTag" | "PackageVersion" | "PinnedDiscussion" | "PinnedEvent" | "PinnedIssue" | "PrivateRepositoryForkingDisableAuditEntry" | "PrivateRepositoryForkingEnableAuditEntry" | "Project" | "ProjectColumn" | "ProjectV2" | "ProjectV2Field" | "ProjectV2Item" | "ProjectV2ItemFieldDateValue" | "ProjectV2ItemFieldIterationValue" | "ProjectV2ItemFieldNumberValue" | "ProjectV2ItemFieldSingleSelectValue" | "ProjectV2ItemFieldTextValue" | "ProjectV2IterationField" | "ProjectV2SingleSelectField" | "ProjectV2View" | "ProjectV2Workflow" | "PublicKey" | "PullRequest" | "PullRequestCommit" | "PullRequestCommitCommentThread" | "PullRequestReview" | "PullRequestReviewComment" | "PullRequestReviewThread" | "PullRequestThread" | "Push" | "PushAllowance" | "Reaction" | "ReadyForReviewEvent" | "Ref" | "ReferencedEvent" | "Release" | "ReleaseAsset" | "RemovedFromMergeQueueEvent" | "RemovedFromProjectEvent" | "RenamedTitleEvent" | "ReopenedEvent" | "RepoAccessAuditEntry" | "RepoAddMemberAuditEntry" | "RepoAddTopicAuditEntry" | "RepoArchivedAuditEntry" | "RepoChangeMergeSettingAuditEntry" | "RepoConfigDisableAnonymousGitAccessAuditEntry" | "RepoConfigDisableCollaboratorsOnlyAuditEntry" | "RepoConfigDisableContributorsOnlyAuditEntry" | "RepoConfigDisableSockpuppetDisallowedAuditEntry" | "RepoConfigEnableAnonymousGitAccessAuditEntry" | "RepoConfigEnableCollaboratorsOnlyAuditEntry" | "RepoConfigEnableContributorsOnlyAuditEntry" | "RepoConfigEnableSockpuppetDisallowedAuditEntry" | "RepoConfigLockAnonymousGitAccessAuditEntry" | "RepoConfigUnlockAnonymousGitAccessAuditEntry" | "RepoCreateAuditEntry" | "RepoDestroyAuditEntry" | "RepoRemoveMemberAuditEntry" | "RepoRemoveTopicAuditEntry" | "Repository" | "RepositoryDependabotAlertsThread" | "RepositoryInvitation" | "RepositoryMigration" | "RepositoryRule" | "RepositoryRuleset" | "RepositoryRulesetBypassActor" | "RepositoryTopic" | "RepositoryVisibilityChangeDisableAuditEntry" | "RepositoryVisibilityChangeEnableAuditEntry" | "RepositoryVulnerabilityAlert" | "ReviewDismissalAllowance" | "ReviewDismissedEvent" | "ReviewRequest" | "ReviewRequestRemovedEvent" | "ReviewRequestedEvent" | "SavedReply" | "SecurityAdvisory" | "SponsorsActivity" | "SponsorsListing" | "SponsorsListingFeaturedItem" | "SponsorsTier" | "Sponsorship" | "SponsorshipNewsletter" | "Status" | "StatusCheckRollup" | "StatusContext" | "SubscribedEvent" | "Tag" | "Team" | "TeamAddMemberAuditEntry" | "TeamAddRepositoryAuditEntry" | "TeamChangeParentTeamAuditEntry" | "TeamDiscussion" | "TeamDiscussionComment" | "TeamRemoveMemberAuditEntry" | "TeamRemoveRepositoryAuditEntry" | "Topic" | "TransferredEvent" | "Tree" | "UnassignedEvent" | "UnlabeledEvent" | "UnlockedEvent" | "UnmarkedAsDuplicateEvent" | "UnpinnedEvent" | "UnsubscribedEvent" | "User" | "UserBlockedEvent" | "UserContentEdit" | "UserList" | "UserStatus" | "VerifiableDomain" | "Workflow" | "WorkflowRun" | "WorkflowRunFile";
}

export interface CardIdToPr_node_ProjectCard_content_Issue {
  __typename: "Issue";
}

export interface CardIdToPr_node_ProjectCard_content_PullRequest {
  __typename: "PullRequest";
  /**
   * Identifies the state of the pull request.
   */
  state: PullRequestState;
  /**
   * Identifies the pull request number.
   */
  number: number;
}

export type CardIdToPr_node_ProjectCard_content = CardIdToPr_node_ProjectCard_content_Issue | CardIdToPr_node_ProjectCard_content_PullRequest;

export interface CardIdToPr_node_ProjectCard {
  __typename: "ProjectCard";
  /**
   * The card content item
   */
  content: CardIdToPr_node_ProjectCard_content | null;
}

export type CardIdToPr_node = CardIdToPr_node_AddedToMergeQueueEvent | CardIdToPr_node_ProjectCard;

export interface CardIdToPr {
  /**
   * Fetches an object given its ID.
   */
  node: CardIdToPr_node | null;
}

export interface CardIdToPrVariables {
  id: string;
}
