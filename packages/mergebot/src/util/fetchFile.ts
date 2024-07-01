import { client } from "../graphql-client";
import { GetFileContent } from "../queries/file-query";

export async function fetchFile(expr: string, limit?: number): Promise<string | undefined> {
  const info = await client.query({
    query: GetFileContent,
    variables: {
      name: "DefinitelyTyped",
      owner: "DefinitelyTyped",
      expr: `${expr}`,
    },
  });
  const obj = info.data.repository?.object;
  if (!obj || obj.__typename !== "Blob") return undefined;
  if (obj.text && limit && obj.text.length > limit) {
    return obj.text.substring(0, limit);
  } else if (obj.byteSize > 3_000_000 && !obj.text) {
    throw new Error(`Blob too big to fetch: ${expr}`);
  } else {
    return obj.text ?? undefined;
  }
}
