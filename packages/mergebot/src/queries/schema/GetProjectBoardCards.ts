/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetProjectBoardCards
// ====================================================

export interface GetProjectBoardCards_repository_projectV2_items_pageInfo {
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

export interface GetProjectBoardCards_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldDateValue {
  __typename:
    | "ProjectV2ItemFieldDateValue"
    | "ProjectV2ItemFieldIterationValue"
    | "ProjectV2ItemFieldLabelValue"
    | "ProjectV2ItemFieldMilestoneValue"
    | "ProjectV2ItemFieldNumberValue"
    | "ProjectV2ItemFieldPullRequestValue"
    | "ProjectV2ItemFieldRepositoryValue"
    | "ProjectV2ItemFieldReviewerValue"
    | "ProjectV2ItemFieldTextValue"
    | "ProjectV2ItemFieldUserValue";
}

export interface GetProjectBoardCards_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldSingleSelectValue {
  __typename: "ProjectV2ItemFieldSingleSelectValue";
  /**
   * The name of the selected single select option.
   */
  name: string | null;
}

export type GetProjectBoardCards_repository_projectV2_items_nodes_fieldValueByName =
  | GetProjectBoardCards_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldDateValue
  | GetProjectBoardCards_repository_projectV2_items_nodes_fieldValueByName_ProjectV2ItemFieldSingleSelectValue;

export interface GetProjectBoardCards_repository_projectV2_items_nodes {
  __typename: "ProjectV2Item";
  /**
   * The Node ID of the ProjectV2Item object
   */
  id: string;
  /**
   * The field value of the first project field which matches the 'name' argument that is set on the item.
   */
  fieldValueByName: GetProjectBoardCards_repository_projectV2_items_nodes_fieldValueByName | null;
  /**
   * Identifies the date and time when the object was last updated.
   */
  updatedAt: any;
}

export interface GetProjectBoardCards_repository_projectV2_items {
  __typename: "ProjectV2ItemConnection";
  /**
   * Information to aid in pagination.
   */
  pageInfo: GetProjectBoardCards_repository_projectV2_items_pageInfo;
  /**
   * Identifies the total count of items in the connection.
   */
  totalCount: number;
  /**
   * A list of nodes.
   */
  nodes: (GetProjectBoardCards_repository_projectV2_items_nodes | null)[] | null;
}

export interface GetProjectBoardCards_repository_projectV2 {
  __typename: "ProjectV2";
  /**
   * The Node ID of the ProjectV2 object
   */
  id: string;
  /**
   * List of items in the project
   */
  items: GetProjectBoardCards_repository_projectV2_items;
}

export interface GetProjectBoardCards_repository {
  __typename: "Repository";
  /**
   * Finds and returns the Project according to the provided Project number.
   */
  projectV2: GetProjectBoardCards_repository_projectV2 | null;
}

export interface GetProjectBoardCards {
  /**
   * Lookup a given repository by the owner and repository name.
   */
  repository: GetProjectBoardCards_repository | null;
}

export interface GetProjectBoardCardsVariables {
  cursor?: string | null;
}
