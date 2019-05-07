export const config = {
  database: {
    benchmarksDatabaseId: 'benchmarks',
    packageBenchmarksContainerId: 'packageBenchmarks',
    endpoint: 'https://dt-perf.documents.azure.com:443/',
    writeKey: process.env.DATABASE_WRITE_KEY,
    readKey: process.env.DATABASE_READ_KEY,
  },
};
