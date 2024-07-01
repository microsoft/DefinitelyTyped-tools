import { gql, TypedDocumentNode } from "@apollo/client/core";
import { client } from "../graphql-client";
import { GetProjectBoardCards } from "./schema/GetProjectBoardCards";

// 1. bold to assume that no column has >100 cards (I've done this)
// 2. need to unnest card expr
// 3. need to paginate card exprs
// 4. need to gather back into columns by hand probably
// (and maybe assert that the card is only in one column)
const getProjectBoardCardsQuery: TypedDocumentNode<GetProjectBoardCards, never> = gql`
  query GetProjectBoardCards {
    repository(owner: "DefinitelyTyped", name: "DefinitelyTyped") {
      id
      project(number: 5) {
        id
        columns(first: 100) {
          nodes {
            id
            name
            cards(last: 100) {
              totalCount
              nodes {
                id
                updatedAt
              }
            }
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

export async function getProjectBoardCards() {
  const results = await client.query({
    query: getProjectBoardCardsQuery,
    fetchPolicy: "no-cache",
  });

  const project = results.data.repository?.project;

  if (!project) {
    throw new Error("No project found");
  }

  const columns: ColumnInfo[] = [];
  project.columns.nodes?.forEach((col) => {
    if (!col) return;
    const cards: CardInfo[] = [];
    col.cards.nodes?.forEach((card) => card && cards.push({ id: card.id, updatedAt: card.updatedAt }));
    columns.push({
      name: col.name,
      totalCount: col.cards.totalCount,
      cards,
    });
  });

  return columns;
}
