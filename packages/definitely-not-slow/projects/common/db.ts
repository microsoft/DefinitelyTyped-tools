import { CosmosClient } from '@azure/cosmos';
import { config } from './config';

export const enum DatabaseAccessLevel {
  Read,
  Write
}

const keys: { [K in DatabaseAccessLevel]: string | undefined } = {
  [DatabaseAccessLevel.Read]: config.database.readKey,
  [DatabaseAccessLevel.Write]: config.database.writeKey,
};

export async function getDatabase(accessLevel: DatabaseAccessLevel) {
  const client = new CosmosClient({
    endpoint: config.database.endpoint,
    key: keys[accessLevel],
  });

  const { database } = await client.databases.createIfNotExists({
    id: config.database.benchmarksDatabaseId,
  });

  const { container } = await database.containers.createIfNotExists({
    id: config.database.packageBenchmarksContainerId,
  });

  return { database, container };
}
