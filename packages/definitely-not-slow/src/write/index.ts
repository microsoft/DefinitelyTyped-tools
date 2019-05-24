import { Container } from '@azure/cosmos';
import { PackageBenchmarkSummary, createDocument } from '../common';

export async function insertPackageBenchmark(benchmark: PackageBenchmarkSummary, version: number, container: Container) {
  return container.items.create(createDocument(benchmark, version));
}
