import { client } from "../graphql-client";
import { graphql } from "./graphql";

export const runQueryToGetPRForCardId = async (id: string) => {
  const info = await client.query({
    query: graphql(`
      query CardIdToPr($id: ID!) {
        node(id: $id) {
          __typename
          ... on ProjectV2Item {
            content {
              __typename
              ... on PullRequest {
                state
                number
              }
            }
          }
        }
      }
    `),
    variables: { id },
    fetchPolicy: "no-cache",
  });
  const node = info.data?.node;
  return node?.__typename === "ProjectV2Item" && node.content?.__typename === "PullRequest"
    ? { number: node.content.number, state: node.content.state }
    : undefined;
};
