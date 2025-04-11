/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetAllOpenPRs
// ====================================================

export interface GetAllOpenPRs_repository_pullRequests_nodes {
  __typename: "PullRequest";
  /**
   * Identifies the pull request number.
   */
  number: number;
}

export interface GetAllOpenPRs_repository_pullRequests_pageInfo {
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

export interface GetAllOpenPRs_repository_pullRequests {
  __typename: "PullRequestConnection";
  /**
   * A list of nodes.
   */
  nodes: (GetAllOpenPRs_repository_pullRequests_nodes | null)[] | null;
  /**
   * Information to aid in pagination.
   */
  pageInfo: GetAllOpenPRs_repository_pullRequests_pageInfo;
}

export interface GetAllOpenPRs_repository {
  __typename: "Repository";
  /**
   * The Node ID of the Repository object
   */
  id: string;
  /**
   * A list of pull requests that have been opened in the repository.
   */
  pullRequests: GetAllOpenPRs_repository_pullRequests;
}

export interface GetAllOpenPRs {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: GetAllOpenPRs_repository | null;
}

export interface GetAllOpenPRsVariables {
  endCursor?: string | null;
}
