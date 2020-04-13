import { Container, Item } from "@azure/cosmos";
import { PackageBenchmarkSummary, createDocument, TypeScriptComparisonRun } from "../common";

export async function insertDocument(
  comparison: TypeScriptComparisonRun,
  version: number,
  container: Container
): Promise<Item>;
export async function insertDocument(
  benchmark: PackageBenchmarkSummary,
  version: number,
  container: Container
): Promise<Item>;
export async function insertDocument(
  benchmark: PackageBenchmarkSummary | TypeScriptComparisonRun,
  version: number,
  container: Container
): Promise<Item> {
  const response = await container.items.create(createDocument(benchmark, version));
  return response.item;
}
