import { getLabels as getLabelsRaw, getProjectColumns } from "../queries/label-columns-queries";
import { GetProjectColumns } from "../queries/schema/GetProjectColumns";
import { client } from "../graphql-client";
import { noNullish } from "./util";

export async function getProjectBoardColumns(): Promise<Map<string, string>> {
  let cursor: string | null = null;
  const columns: Map<string, string> = new Map();
  do {
    const results: GetProjectColumns = (await client.query({ query: getProjectColumns, variables: { cursor } })).data;
    const project = results.repository?.projectV2;
    for (const card of noNullish(project?.items?.nodes)) {
      if (
        card.fieldValueByName?.__typename === "ProjectV2ItemFieldSingleSelectValue" &&
        card.fieldValueByName.name &&
        card.fieldValueByName.optionId
      ) {
        columns.set(card.fieldValueByName.name, card.fieldValueByName.optionId);
      }
    }
    cursor = project?.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (cursor);
  return columns;
}

export async function getLabels() {
  const res = await getLabelsRaw();
  return res.filter((l) => !l.name.startsWith("Pkg:")).sort((a, b) => a.name.localeCompare(b.name));
}
