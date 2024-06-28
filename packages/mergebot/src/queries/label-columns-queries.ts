import { gql, TypedDocumentNode } from "@apollo/client/core";
import { GetLabels, GetLabelsVariables, GetLabels_repository_labels_nodes } from "./schema/GetLabels";
import { GetProjectColumns as getProjectColumns } from "./schema/GetProjectColumns";
import { client } from "../graphql-client";
import { noNullish } from "../util/util";

export { getLabels, getProjectColumns as GetProjectColumns };

const getLabelsQuery: TypedDocumentNode<GetLabels, GetLabelsVariables> = gql`
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
// TODO: projects don't have columns anymore; they have states -- and I'm not sure they're enumerable
// might need to iterate thru cards and check the state of them
const getProjectColumns: TypedDocumentNode<getProjectColumns, unknown> = gql`
  query GetProjectColumns {
    repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
      id
      project(number: 5) {
        id
        columns(first: 30) {
          nodes {
            id
            name
          }
        }
      }
    }
  }
`;
