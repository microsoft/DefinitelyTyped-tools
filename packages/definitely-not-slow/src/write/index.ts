import { Container } from '@azure/cosmos';
import { Document, PackageBenchmarkSummary, getSystemInfo } from '../common';

function createDocument<T>(body: T, version: number): Document<T> {
  return {
    version,
    createdAt: new Date(),
    system: getSystemInfo(),
    body,
  };
}

export async function insertPackageBenchmark(benchmark: PackageBenchmarkSummary, version: number, container: Container) {
  return container.items.create(createDocument(benchmark, version));
}
