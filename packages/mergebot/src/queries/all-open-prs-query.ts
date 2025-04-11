import { gql, TypedDocumentNode } from "@apollo/client/core";
import { client } from "../graphql-client";
import { GetAllOpenPRs, GetAllOpenPRsVariables } from "./schema/GetAllOpenPRs";
import { noNullish } from "../util/util";

const getAllOpenPRsQuery: TypedDocumentNode<GetAllOpenPRs, GetAllOpenPRsVariables> = gql`
  query GetAllOpenPRs($endCursor: String) {
    repository(owner: "DefinitelyTyped", name: "DefinitelyTyped") {
      id
      pullRequests(states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }, first: 100, after: $endCursor) {
        nodes {
          number
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export async function getAllOpenPRs() {
  const prs: number[] = [];
  let endCursor: string | undefined | null;
  while (true) {
    const result = await client.query({
      query: getAllOpenPRsQuery,
      fetchPolicy: "no-cache",
      variables: { endCursor },
    });
    const pullRequests = result.data.repository?.pullRequests;
    prs.push(...noNullish(pullRequests?.nodes).map((pr) => pr.number));
    if (!pullRequests?.pageInfo.hasNextPage) return prs;
    endCursor = pullRequests.pageInfo.endCursor;
  }
}
