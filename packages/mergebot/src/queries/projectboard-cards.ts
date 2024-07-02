import { ApolloQueryResult, gql, TypedDocumentNode } from "@apollo/client/core";
import { client } from "../graphql-client";
import {
  GetProjectBoardCards,
  GetProjectBoardCards_repository_projectV2,
  GetProjectBoardCardsVariables,
} from "./schema/GetProjectBoardCards";

const getProjectBoardCardsQuery: TypedDocumentNode<GetProjectBoardCards, GetProjectBoardCardsVariables> = gql`
  query GetProjectBoardCards($cursor: String) {
    repository(owner: "DefinitelyTyped", name: "DefinitelyTyped") {
      projectV2(number: 1) {
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
interface ColumnInfo {
  name: string;
  totalCount: number;
  cards: CardInfo[];
}
export async function getProjectBoardCards(): Promise<ColumnInfo[]> {
  let cursor: string | null = null;
  const columnMap: Map<string, CardInfo[]> = new Map();
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
      const column = columnMap.get(status) || [];
      column.push({ id: card.id, updatedAt: card.updatedAt });
      columnMap.set(status, column);
    }
    if (project.items.pageInfo.hasNextPage) {
      cursor = project.items.pageInfo.endCursor;
    }
  } while (cursor);
  return Array.from(columnMap.entries()).map(([name, cards]) => ({ name, totalCount: cards.length, cards }));
}
