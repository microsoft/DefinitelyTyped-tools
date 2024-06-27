import { gql, TypedDocumentNode } from "@apollo/client/core";
import { GetFileContent, GetFileContentVariables } from "./schema/GetFileContent";

export { GetFileContent };

const GetFileContent: TypedDocumentNode<GetFileContent, GetFileContentVariables> = gql`
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
  }`;
