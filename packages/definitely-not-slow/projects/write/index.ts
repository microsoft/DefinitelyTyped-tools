import { Container } from '@azure/cosmos';
import { PackageBenchmark } from '../common';

export async function insertBenchmark(benchmark: PackageBenchmark, container: Container) {
  return container.items.create(benchmark, { partitionKey: 'packageName' });
}
