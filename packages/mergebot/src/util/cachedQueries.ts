import { getLabels as getLabelsRaw, getProjectColumns } from "../queries/label-columns-queries";
import type { GetProjectColumnsQueryVariables } from "../queries/schema/graphql";
import { client } from "../graphql-client";
import { noNullish } from "./util";

export async function getProjectBoardColumns(): Promise<Map<string, string>> {
  let cursor: string | null = null;
  const columns: Map<string, string> = new Map();
  while (true) {
    const vars: GetProjectColumnsQueryVariables = { cursor };
    const result = await client.query({ query: getProjectColumns, variables: vars });
    const project = result.data?.repository?.projectV2;
    for (const field of noNullish(project?.fields?.nodes)) {
      if (field?.__typename === "ProjectV2SingleSelectField" && field.name === "Status") {
        for (const option of field.options) {
          if (option.name && option.id) {
            columns.set(option.name, option.id);
          }
        }
      }
    }
    if (!project?.fields.pageInfo.hasNextPage) break;
    cursor = project.fields.pageInfo.endCursor ?? null;
  }
  return columns;
}

export async function getLabels() {
  const res = await getLabelsRaw();
  return res.filter((l): l is NonNullable<typeof l> => !!l && !l.name.startsWith("Pkg:")).sort((a, b) => a.name.localeCompare(b.name));
}
