/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetProjectColumns
// ====================================================

export interface GetProjectColumns_repository_projectV2_fields_pageInfo {
  __typename: "PageInfo";
  /**
   * When paginating backwards, the cursor to continue.
   */
  startCursor: string | null;
  /**
   * When paginating forwards, are there more items?
   */
  hasNextPage: boolean;
  /**
   * When paginating forwards, the cursor to continue.
   */
  endCursor: string | null;
}

export interface GetProjectColumns_repository_projectV2_fields_nodes_ProjectV2Field {
  __typename: "ProjectV2Field" | "ProjectV2IterationField";
}

export interface GetProjectColumns_repository_projectV2_fields_nodes_ProjectV2SingleSelectField_options {
  __typename: "ProjectV2SingleSelectFieldOption";
  /**
   * The option's ID.
   */
  id: string;
  /**
   * The option's name.
   */
  name: string;
}

export interface GetProjectColumns_repository_projectV2_fields_nodes_ProjectV2SingleSelectField {
  __typename: "ProjectV2SingleSelectField";
  /**
   * The project field's name.
   */
  name: string;
  /**
   * Options for the single select field
   */
  options: GetProjectColumns_repository_projectV2_fields_nodes_ProjectV2SingleSelectField_options[];
}

export type GetProjectColumns_repository_projectV2_fields_nodes = GetProjectColumns_repository_projectV2_fields_nodes_ProjectV2Field | GetProjectColumns_repository_projectV2_fields_nodes_ProjectV2SingleSelectField;

export interface GetProjectColumns_repository_projectV2_fields {
  __typename: "ProjectV2FieldConfigurationConnection";
  /**
   * Information to aid in pagination.
   */
  pageInfo: GetProjectColumns_repository_projectV2_fields_pageInfo;
  /**
   * A list of nodes.
   */
  nodes: (GetProjectColumns_repository_projectV2_fields_nodes | null)[] | null;
}

export interface GetProjectColumns_repository_projectV2 {
  __typename: "ProjectV2";
  /**
   * The Node ID of the ProjectV2 object
   */
  id: string;
  /**
   * List of fields and their constraints in the project
   */
  fields: GetProjectColumns_repository_projectV2_fields;
}

export interface GetProjectColumns_repository {
  __typename: "Repository";
  /**
   * The Node ID of the Repository object
   */
  id: string;
  /**
   * Finds and returns the Project according to the provided Project number.
   */
  projectV2: GetProjectColumns_repository_projectV2 | null;
}

export interface GetProjectColumns {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: GetProjectColumns_repository | null;
}

export interface GetProjectColumnsVariables {
  cursor?: string | null;
}
