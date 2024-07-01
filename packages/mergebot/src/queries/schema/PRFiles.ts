/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: PRFiles
// ====================================================

export interface PRFiles_repository_pullRequest_files_nodes {
  __typename: "PullRequestChangedFile";
  /**
   * The path of the file.
   */
  path: string;
  /**
   * The number of additions to the file.
   */
  additions: number;
  /**
   * The number of deletions to the file.
   */
  deletions: number;
}

export interface PRFiles_repository_pullRequest_files_pageInfo {
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

export interface PRFiles_repository_pullRequest_files {
  __typename: "PullRequestChangedFileConnection";
  /**
   * Identifies the total count of items in the connection.
   */
  totalCount: number;
  /**
   * A list of nodes.
   */
  nodes: (PRFiles_repository_pullRequest_files_nodes | null)[] | null;
  /**
   * Information to aid in pagination.
   */
  pageInfo: PRFiles_repository_pullRequest_files_pageInfo;
}

export interface PRFiles_repository_pullRequest {
  __typename: "PullRequest";
  /**
   * Lists the files changed within this pull request.
   */
  files: PRFiles_repository_pullRequest_files | null;
}

export interface PRFiles_repository {
  __typename: "Repository";
  /**
   * Returns a single pull request from the current repository by number.
   */
  pullRequest: PRFiles_repository_pullRequest | null;
}

export interface PRFiles {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: PRFiles_repository | null;
}

export interface PRFilesVariables {
  prNumber: number;
  endCursor?: string | null;
}
