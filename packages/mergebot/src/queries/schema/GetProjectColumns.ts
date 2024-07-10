/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetProjectColumns
// ====================================================

export interface GetProjectColumns_repository_projectV2_items_pageInfo {
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

export interface GetProjectColumns_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldDateValue {
  __typename: "ProjectV2ItemFieldDateValue" | "ProjectV2ItemFieldIterationValue" | "ProjectV2ItemFieldLabelValue" | "ProjectV2ItemFieldMilestoneValue" | "ProjectV2ItemFieldNumberValue" | "ProjectV2ItemFieldPullRequestValue" | "ProjectV2ItemFieldRepositoryValue" | "ProjectV2ItemFieldReviewerValue" | "ProjectV2ItemFieldTextValue" | "ProjectV2ItemFieldUserValue";
}

export interface GetProjectColumns_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldSingleSelectValue {
  __typename: "ProjectV2ItemFieldSingleSelectValue";
  /**
   * The name of the selected single select option.
   */
  name: string | null;
  /**
   * The id of the selected single select option.
   */
  optionId: string | null;
}

export type GetProjectColumns_repository_projectV2_items_nodes_fieldValueByName = GetProjectColumns_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldDateValue | GetProjectColumns_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldSingleSelectValue;

export interface GetProjectColumns_repository_projectV2_items_nodes {
  __typename: "ProjectV2Item";
  /**
   * The field value of the first project field which matches the 'name' argument that is set on the item.
   */
  fieldValueByName: GetProjectColumns_repository_projectV2_items_nodes_fieldValueByName | null;
}

export interface GetProjectColumns_repository_projectV2_items {
  __typename: "ProjectV2ItemConnection";
  /**
   * Information to aid in pagination.
   */
  pageInfo: GetProjectColumns_repository_projectV2_items_pageInfo;
  /**
   * A list of nodes.
   */
  nodes: (GetProjectColumns_repository_projectV2_items_nodes | null)[] | null;
}

export interface GetProjectColumns_repository_projectV2 {
  __typename: "ProjectV2";
  /**
   * The Node ID of the ProjectV2 object
   */
  id: string;
  /**
   * List of items in the project
   */
  items: GetProjectColumns_repository_projectV2_items;
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
