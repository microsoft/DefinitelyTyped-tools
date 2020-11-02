import { Container } from "@azure/cosmos";
import { DependencyVersion, formatDependencyVersion } from "@definitelytyped/definitions-parser";
import { config, PackageBenchmarkSummary, Document, QueryResult } from "../common";

export interface GetLatestBenchmarkOptions {
  container: Container;
  packageName: string;
  packageVersion: DependencyVersion;
  typeScriptVersionMajorMinor: string;
}

export async function getLatestBenchmark({
  container,
  packageName,
  packageVersion,
  typeScriptVersionMajorMinor
}: GetLatestBenchmarkOptions): Promise<QueryResult<Document<PackageBenchmarkSummary>> | undefined> {
  const response = await container.items
    .query<QueryResult<Document<PackageBenchmarkSummary>>>({
      query:
        `SELECT TOP 1 * FROM ${config.database.packageBenchmarksContainerId} b` +
        `  WHERE b.body.packageName = @packageName` +
        `  AND b.body.packageVersion = @packageVersion` +
        `  AND b.body.typeScriptVersionMajorMinor = @tsVersion` +
        `  ORDER BY b.createdAt DESC`,
      parameters: [
        { name: "@packageName", value: packageName },
        { name: "@packageVersion", value: formatDependencyVersion(packageVersion) },
        { name: "@tsVersion", value: typeScriptVersionMajorMinor }
      ]
    })
    .fetchNext();
  return response.resources[0];
}
