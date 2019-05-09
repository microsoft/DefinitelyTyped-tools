import { assertDefined } from 'types-publisher/bin/util/util';

export const config = {
  database: {
    benchmarksDatabaseId: 'benchmarks',
    packageBenchmarksContainerId: 'packageBenchmarks',
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
