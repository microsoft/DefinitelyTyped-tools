import { CosmosClient } from '@azure/cosmos';
import { config } from './config';
import { assertNever } from 'types-publisher/bin/util/util';

export const enum DatabaseAccessLevel {
  Read = 'read',
  Write = 'write',
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
};

export async function getDatabase(accessLevel: DatabaseAccessLevel) {
  const client = new CosmosClient({
    endpoint: config.database.endpoint,
    key: getKey(accessLevel),
  });

  const { database } = await client.databases.createIfNotExists({
    id: config.database.benchmarksDatabaseId,
  });

  const { container } = await database.containers.createIfNotExists({
    id: config.database.packageBenchmarksContainerId,
    partitionKey: {
      kind: 'Hash',
      paths: ['/body/packageName']
    }
  });

  return { database, container };
}
