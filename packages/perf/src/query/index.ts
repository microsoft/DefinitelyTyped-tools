import { Container } from "@azure/cosmos";
import { DirectoryParsedTypingVersion } from "@definitelytyped/definitions-parser";
import { config, PackageBenchmarkSummary, Document, QueryResult } from "../common";

export interface GetLatestBenchmarkOptions {
  container: Container;
  packageName: string;
  packageVersion: DirectoryParsedTypingVersion;
  matchMinor: boolean;
  typeScriptVersionMajorMinor: string;
}

export async function getLatestBenchmark({
  container,
  packageName,
  packageVersion,
  matchMinor,
  typeScriptVersionMajorMinor
}: GetLatestBenchmarkOptions): Promise<QueryResult<Document<PackageBenchmarkSummary>> | undefined> {
  const response = await container.items
    .query<QueryResult<Document<PackageBenchmarkSummary>>>({
      query:
        `SELECT TOP 1 * FROM ${config.database.packageBenchmarksContainerId} b` +
        `  WHERE b.body.packageName = @packageName` +
        `  AND b.body.packageVersionMajor = @packageVersionMajor` +
        (matchMinor ? ` AND b.body.packageVersionMinor = @packageVersionMinor` : "") +
        `  AND b.body.typeScriptVersionMajorMinor = @tsVersion` +
        `  ORDER BY b.createdAt DESC`,
      parameters: [
        { name: "@packageName", value: packageName },
        { name: "@packageVersionMajor", value: packageVersion.major },
        { name: "@packageVersionMinor", value: packageVersion.minor ?? "" },
        { name: "@tsVersion", value: typeScriptVersionMajorMinor }
      ]
    })
    .fetchNext();
  return response.resources[0];
}
