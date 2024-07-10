import { ApolloQueryResult, gql, TypedDocumentNode } from "@apollo/client/core";
import { client } from "../graphql-client";
import { GetProjectBoardCards, GetProjectBoardCardsVariables } from "./schema/GetProjectBoardCards";

const getProjectBoardCardsQuery: TypedDocumentNode<GetProjectBoardCards, GetProjectBoardCardsVariables> = gql`
  query GetProjectBoardCards($cursor: String) {
    repository(owner: "DefinitelyTyped", name: "DefinitelyTyped") {
      projectV2(number: 1) {
        id
        items(first: 100, after: $cursor) {
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
          totalCount
          nodes {
            id
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
            updatedAt
          }
        }
      }
    }
  }
`;

interface CardInfo {
  id: string;
  updatedAt: string;
}
interface BoardInfo {
  id: string;
  columns: Map<string, CardInfo[]>;
}
export async function getProjectBoardCards(): Promise<BoardInfo> {
  let cursor: string | null = null;
  let id: string;
  const columns: Map<string, CardInfo[]> = new Map();
  do {
    const results: ApolloQueryResult<GetProjectBoardCards> = await client.query({
      query: getProjectBoardCardsQuery,
      variables: { cursor },
      fetchPolicy: "no-cache",
    });

    const project = results.data.repository?.projectV2;
    if (!project || !project.items.nodes) {
      throw new Error("No project found");
    }
    id = project.id;
    for (const card of project.items.nodes) {
      if (!card) {
        continue;
      }
      if (card.fieldValueByName?.__typename !== "ProjectV2ItemFieldSingleSelectValue") {
        throw new Error("Unexpected card property type: " + card.fieldValueByName?.__typename);
      }
      const status = card.fieldValueByName.name;
      if (status === null) {
        throw new Error("Unexpected column: " + status);
      }
      const column = columns.get(status) || [];
      column.push({ id: card.id, updatedAt: card.updatedAt });
      columns.set(status, column);
    }
    cursor = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (cursor);
  return { columns, id };
}
