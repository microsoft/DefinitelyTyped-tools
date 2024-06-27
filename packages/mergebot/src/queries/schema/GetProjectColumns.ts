/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetProjectColumns
// ====================================================

export interface GetProjectColumns_repository_project_columns_nodes {
  __typename: "ProjectColumn";
  /**
   * The Node ID of the ProjectColumn object
   */
  id: string;
  /**
   * The project column's name.
   */
  name: string;
}

export interface GetProjectColumns_repository_project_columns {
  __typename: "ProjectColumnConnection";
  /**
   * A list of nodes.
   */
  nodes: (GetProjectColumns_repository_project_columns_nodes | null)[] | null;
}

export interface GetProjectColumns_repository_project {
  __typename: "Project";
  /**
   * The Node ID of the Project object
   */
  id: string;
  /**
   * List of columns in the project
   */
  columns: GetProjectColumns_repository_project_columns;
}

export interface GetProjectColumns_repository {
  __typename: "Repository";
  /**
   * The Node ID of the Repository object
   */
  id: string;
  /**
   * Find project by number.
   */
  project: GetProjectColumns_repository_project | null;
}

export interface GetProjectColumns {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: GetProjectColumns_repository | null;
}
