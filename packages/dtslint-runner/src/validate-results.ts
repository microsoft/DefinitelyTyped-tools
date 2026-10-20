import { lstatSync, readFileSync } from "fs";
import glob = require("glob");
import type { Failure } from "./add-github-links";

export function readComparison(
  mainErrorsPath: string | undefined,
  branchErrorsPath: string | undefined,
  expectedShardCount: string | undefined,
): { main: Failure[]; branch: Failure[] } {
  try {
    const shardCount = Number(expectedShardCount);
    if (
      !mainErrorsPath ||
      !branchErrorsPath ||
      !Number.isSafeInteger(shardCount) ||
      shardCount < 1 ||
      String(shardCount) !== expectedShardCount
    ) {
      throw new Error();
    }
    return {
      main: readFailures(mainErrorsPath, "main", shardCount),
      branch: readFailures(branchErrorsPath, "pr", shardCount),
    };
  } catch {
    // JSON parse and filesystem errors can contain artifact-controlled command markers.
    throw new Error("Missing or invalid DT failure artifacts.");
  }
}

function readFailures(directory: string, prefix: "main" | "pr", shardCount: number): Failure[] {
  const result: Failure[] = [];
  for (let shard = 1; shard <= shardCount; shard++) {
    const files = glob.sync(`**/${prefix}Failures${shard}.json`, { cwd: directory, absolute: true });
    if (files.length !== 1 || !lstatSync(files[0]).isFile()) {
      throw new Error();
    }
    const failures: unknown = JSON.parse(readFileSync(files[0], "utf8"));
    if (!Array.isArray(failures) || !failures.every(isFailure)) {
      throw new Error();
    }
    result.push(...failures);
  }
  return result;
}

function isFailure(value: unknown): value is Failure {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "error" in value &&
    typeof value.error === "string"
  );
}

if (require.main === module) {
  const [shardCount, mainErrorsPath, branchErrorsPath] = process.argv.slice(2);
  try {
    readComparison(mainErrorsPath, branchErrorsPath, shardCount);
  } catch {
    console.error("Missing or invalid DT failure artifacts.");
    process.exitCode = 1;
  }
}
