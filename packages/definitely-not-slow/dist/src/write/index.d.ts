import { Container } from '@azure/cosmos';
import { PackageBenchmarkSummary } from '../common';
export declare function insertPackageBenchmark(benchmark: PackageBenchmarkSummary, version: number, container: Container): Promise<import("@azure/cosmos").ItemResponse<import("@azure/cosmos").ItemDefinition>>;
