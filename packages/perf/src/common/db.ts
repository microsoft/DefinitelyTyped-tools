import { CosmosClient, Database, Container } from "@azure/cosmos";
import { config } from "./config";
import { assertNever } from "@definitelytyped/utils";

export const enum DatabaseAccessLevel {
  Read = "read",
  Write = "write"
}

function getKey(accessLevel: DatabaseAccessLevel) {
  switch (accessLevel) {
    case DatabaseAccessLevel.Read:
      return config.database.readKey;
    case DatabaseAccessLevel.Write:
      return config.database.writeKey;
    default:
      assertNever(accessLevel);
  }
}

export async function getDatabase(
  accessLevel: DatabaseAccessLevel
): Promise<{
  database: Database;
  packageBenchmarks: Container;
  typeScriptComparisons: Container;
}> {
  const client = new CosmosClient({
    endpoint: config.database.endpoint,
    key: getKey(accessLevel)
  });

  const { database } = await client.databases.createIfNotExists({
    id: config.database.benchmarksDatabaseId
  });

  const { container: packageBenchmarks } = await database.containers.createIfNotExists({
    id: config.database.packageBenchmarksContainerId,
    partitionKey: {
      kind: "Hash",
      paths: ["/body/packageName"]
    }
  });

  const { container: typeScriptComparisons } = await database.containers.createIfNotExists({
    id: config.database.typeScriptComparisonsContainerId
  });

  return { database, packageBenchmarks, typeScriptComparisons };
}
