import { gql, TypedDocumentNode } from "@apollo/client/core";
import { client } from "../graphql-client";
import type {
  GetLabelByNameQuery,
  GetLabelByNameQueryVariables,
  GetDiscussionCommentsQuery,
  GetDiscussionCommentsQueryVariables,
} from "./schema/graphql";

const getLabelByNameQuery: TypedDocumentNode<GetLabelByNameQuery, GetLabelByNameQueryVariables> = gql`
  query GetLabelByName($name: String!) {
    repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
      id
      name
      labels(query: $name, first: 1) {
        nodes {
          id
          name
        }
      }
    }
  }
`;

export async function getLabelByName(name: string) {
  const info = await client.query({
    query: getLabelByNameQuery,
    variables: { name },
    fetchPolicy: "no-cache",
  });

  const label = info.data?.repository?.labels?.nodes?.[0] ?? undefined;
  return { repoID: info.data?.repository?.id ?? "", label };
}

const getDiscussionCommentsQuery: TypedDocumentNode<GetDiscussionCommentsQuery, GetDiscussionCommentsQueryVariables> =
  gql`
    query GetDiscussionComments($discussionNumber: Int!) {
      repository(name: "DefinitelyTyped", owner: "DefinitelyTyped") {
        name
        discussion(number: $discussionNumber) {
          comments(first: 100) {
            nodes {
              author {
                login
              }
              id
              body
            }
          }
        }
      }
    }
  `;

export async function getCommentsForDiscussionNumber(number: number) {
  const info = await client.query({
    query: getDiscussionCommentsQuery,
    variables: { discussionNumber: number },
    fetchPolicy: "no-cache",
  });

  return info.data?.repository?.discussion?.comments?.nodes ?? [];
}
