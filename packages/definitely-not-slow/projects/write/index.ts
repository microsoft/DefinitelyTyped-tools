import * as os from 'os';
import { Container } from '@azure/cosmos';
import { Document, PackageBenchmarkSummary } from '../common';

function createDocument<T>(body: T, version: number): Document<T> {
  return {
    version,
    createdAt: new Date(),
    system: {
      cpus: os.cpus().map(({ times, ...cpu }) => cpu),
      arch: os.arch(),
      platform: os.platform(),
      release: os.release(),
      totalmem: os.totalmem(),
    },
    body,
  };
}

export async function insertPackageBenchmark(benchmark: PackageBenchmarkSummary, version: number, container: Container) {
  return container.items.create(createDocument(benchmark, version));
}
