import { gql, TypedDocumentNode } from "@apollo/client/core";
import type { GetLabelsQuery, GetLabelsQueryVariables, GetProjectColumnsQuery, GetProjectColumnsQueryVariables } from "./schema/graphql";
import { client } from "../graphql-client";
import { noNullish } from "../util/util";

type GetLabels_repository_labels_nodes = NonNullable<NonNullable<NonNullable<GetLabelsQuery["repository"]>["labels"]>["nodes"]>[number];

export { getLabels, getProjectColumns };

const getLabelsQuery: TypedDocumentNode<GetLabelsQuery, GetLabelsQueryVariables> = gql`
  query GetLabels($endCursor: String) {
    repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
      id
      labels(first: 100, after: $endCursor) {
        nodes {
          id
          name
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

async function getLabels() {
  const labels: GetLabels_repository_labels_nodes[] = [];
  let endCursor: string | undefined | null;
  while (true) {
    const result = await client.query({
      query: getLabelsQuery,
      fetchPolicy: "no-cache",
      variables: { endCursor },
    });
    const someLabels = result.data.repository?.labels;
    labels.push(...noNullish(someLabels?.nodes));
    if (!someLabels?.pageInfo.hasNextPage) return labels;
    endCursor = someLabels.pageInfo.endCursor;
  }
}

const getProjectColumns: TypedDocumentNode<GetProjectColumnsQuery, GetProjectColumnsQueryVariables> = gql`
  query GetProjectColumns($cursor: String) {
    repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
      id
      projectV2(number: 1) {
        id
        fields(first: 100, after: $cursor) {
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
          nodes {
            ... on ProjectV2SingleSelectField {
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;
