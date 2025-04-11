/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetAllOpenPRsAndCardIDs
// ====================================================

export interface GetAllOpenPRsAndCardIDs_repository_pullRequests_nodes {
  __typename: "PullRequest";
  /**
   * Identifies the pull request number.
   */
  number: number;
}

export interface GetAllOpenPRsAndCardIDs_repository_pullRequests_pageInfo {
  __typename: "PageInfo";
  /**
   * When paginating forwards, are there more items?
   */
  hasNextPage: boolean;
  /**
   * When paginating forwards, the cursor to continue.
   */
  endCursor: string | null;
}

export interface GetAllOpenPRsAndCardIDs_repository_pullRequests {
  __typename: "PullRequestConnection";
  /**
   * A list of nodes.
   */
  nodes: (GetAllOpenPRsAndCardIDs_repository_pullRequests_nodes | null)[] | null;
  /**
   * Information to aid in pagination.
   */
  pageInfo: GetAllOpenPRsAndCardIDs_repository_pullRequests_pageInfo;
}

export interface GetAllOpenPRsAndCardIDs_repository {
  __typename: "Repository";
  /**
   * The Node ID of the Repository object
   */
  id: string;
  /**
   * A list of pull requests that have been opened in the repository.
   */
  pullRequests: GetAllOpenPRsAndCardIDs_repository_pullRequests;
}

export interface GetAllOpenPRsAndCardIDs {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: GetAllOpenPRsAndCardIDs_repository | null;
}

export interface GetAllOpenPRsAndCardIDsVariables {
  endCursor?: string | null;
}
