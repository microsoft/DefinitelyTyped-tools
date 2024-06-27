/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetPRForSHA1
// ====================================================

export interface GetPRForSHA1_search_nodes_App {
  __typename: "App" | "Discussion" | "Issue" | "MarketplaceListing" | "Organization" | "Repository" | "User";
}

export interface GetPRForSHA1_search_nodes_PullRequest {
  __typename: "PullRequest";
  /**
   * Identifies the pull request title.
   */
  title: string;
  /**
   * Identifies the pull request number.
   */
  number: number;
  /**
   * `true` if the pull request is closed
   */
  closed: boolean;
}

export type GetPRForSHA1_search_nodes = GetPRForSHA1_search_nodes_App | GetPRForSHA1_search_nodes_PullRequest;

export interface GetPRForSHA1_search {
  __typename: "SearchResultItemConnection";
  /**
   * A list of nodes.
   */
  nodes: (GetPRForSHA1_search_nodes | null)[] | null;
}

export interface GetPRForSHA1 {
  /**
   * Perform a search across resources, returning a maximum of 1,000 results.
   */
  search: GetPRForSHA1_search;
}

export interface GetPRForSHA1Variables {
  query: string;
}
