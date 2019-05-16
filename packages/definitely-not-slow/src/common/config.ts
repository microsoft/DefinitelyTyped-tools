import { assertDefined } from 'types-publisher/bin/util/util';

export const config = {
  benchmarks: {
    languageServiceIterations: 5,
  },
  database: {
    benchmarksDatabaseId: 'benchmarks',
    packageBenchmarksContainerId: 'packageBenchmarks',
    packageBenchmarksDocumentSchemaVersion: 1,
    endpoint: 'https://dt-perf.documents.azure.com:443/',
    get writeKey() {
      return assertDefined(
        process.env.DATABASE_WRITE_KEY,
        `Required environment variable 'DATABASE_WRITE_KEY' was not set`);
    },
    get readKey() {
      return assertDefined(
        process.env.DATABASE_READ_KEY,
        `Required environment variable 'DATABASE_READ_KEY' was not set`);
    }
  },
};
