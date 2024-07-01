/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetProjectBoardCards
// ====================================================

export interface GetProjectBoardCards_repository_project_columns_nodes_cards_nodes {
  __typename: "ProjectCard";
  /**
   * The Node ID of the ProjectCard object
   */
  id: string;
  /**
   * Identifies the date and time when the object was last updated.
   */
  updatedAt: any;
}

export interface GetProjectBoardCards_repository_project_columns_nodes_cards {
  __typename: "ProjectCardConnection";
  /**
   * Identifies the total count of items in the connection.
   */
  totalCount: number;
  /**
   * A list of nodes.
   */
  nodes: (GetProjectBoardCards_repository_project_columns_nodes_cards_nodes | null)[] | null;
}

export interface GetProjectBoardCards_repository_project_columns_nodes {
  __typename: "ProjectColumn";
  /**
   * The Node ID of the ProjectColumn object
   */
  id: string;
  /**
   * The project column's name.
   */
  name: string;
  /**
   * List of cards in the column
   */
  cards: GetProjectBoardCards_repository_project_columns_nodes_cards;
}

export interface GetProjectBoardCards_repository_project_columns {
  __typename: "ProjectColumnConnection";
  /**
   * A list of nodes.
   */
  nodes: (GetProjectBoardCards_repository_project_columns_nodes | null)[] | null;
}

export interface GetProjectBoardCards_repository_project {
  __typename: "Project";
  /**
   * The Node ID of the Project object
   */
  id: string;
  /**
   * List of columns in the project
   */
  columns: GetProjectBoardCards_repository_project_columns;
}

export interface GetProjectBoardCards_repository {
  __typename: "Repository";
  /**
   * The Node ID of the Repository object
   */
  id: string;
  /**
   * Find project by number.
   */
  project: GetProjectBoardCards_repository_project | null;
}

export interface GetProjectBoardCards {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: GetProjectBoardCards_repository | null;
}
