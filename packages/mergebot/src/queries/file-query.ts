import { graphql } from "./graphql";

export { getFileContent as GetFileContent };

const getFileContent = graphql(`
  query GetFileContent($owner: String!, $name: String!, $expr: String!) {
    repository(owner: $owner, name: $name) {
      id
      object(expression: $expr) {
        __typename
        ... on Blob {
          text
          byteSize
        }
      }
    }
  }
`);
