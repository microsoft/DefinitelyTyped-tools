import { gql, TypedDocumentNode } from "@apollo/client/core";
import type { GetFileContentQuery, GetFileContentQueryVariables } from "./schema/graphql";

export { getFileContent as GetFileContent };

const getFileContent: TypedDocumentNode<GetFileContentQuery, GetFileContentQueryVariables> = gql`
  query GetFileContent($owner: String!, $name: String!, $expr: String!) {
    repository(owner: $owner, name: $name) {
      id
      object(expression: $expr) {
        ... on Blob {
          text
          byteSize
        }
      }
    }
  }
`;
