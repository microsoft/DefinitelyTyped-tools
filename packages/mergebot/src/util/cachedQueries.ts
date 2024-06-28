import { TypedDocumentNode } from "@apollo/client/core";
import { getLabels as getLabelsRaw, GetProjectColumns } from "../queries/label-columns-queries";
import { client } from "../graphql-client";
import { noNullish } from "./util";

export async function getProjectBoardColumns() {
  const res = noNullish((await query(GetProjectColumns)).repository?.project?.columns.nodes);
  return res.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLabels() {
  const res = await getLabelsRaw();
  return res.filter((l) => !l.name.startsWith("Pkg:")).sort((a, b) => a.name.localeCompare(b.name));
}

async function query<T>(gql: TypedDocumentNode<T>): Promise<T> {
  const res = await client.query({ query: gql });
  return res.data;
}
