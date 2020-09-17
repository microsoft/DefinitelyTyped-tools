import * as fs from "fs";
import { promisify } from "util";
import {
  getDatabase,
  getParsedPackages,
  DatabaseAccessLevel,
  compact,
  getSystemInfo,
  getChangedPackages,
  packageIdsAreEqual,
  systemsAreCloseEnough
} from "../common";
import { BenchmarkPackageOptions } from "./benchmark";
import { getLatestBenchmark } from "../query";
import { nAtATime } from "@definitelytyped/utils";
import { getAffectedPackages, PackageId, formatDependencyVersion } from "@definitelytyped/definitions-parser";
const writeFile = promisify(fs.writeFile);
const currentSystem = getSystemInfo();

export interface GetPackagesToBenchmarkOptions {
  definitelyTypedPath: string;
  tsVersion: string;
  agentCount: number;
  outFile: string;
}

export async function getPackagesToBenchmark({
  definitelyTypedPath,
  agentCount,
  tsVersion,
  outFile
}: GetPackagesToBenchmarkOptions) {
  if (tsVersion.split(".").length !== 2) {
    throw new Error(`Argument 'typeScriptVersion' must be in format 'major.minor' (e.g. '3.1')`);
  }

  const { allPackages } = await getParsedPackages(definitelyTypedPath);
  const { packageBenchmarks: container } = await getDatabase(DatabaseAccessLevel.Read);
  const changedPackages = await nAtATime(10, allPackages.allTypings(), async typingsData => {
    const result = await getLatestBenchmark({
      container,
      typeScriptVersionMajorMinor: tsVersion,
      packageName: typingsData.id.name,
      packageVersion: formatDependencyVersion(typingsData.id.version)
    });

    // No previous run exists; run one
    if (!result) {
      return typingsData.id;
    }

    // System specs are different; run it
    if (!systemsAreCloseEnough(result.system, currentSystem)) {
      console.log(
        `Queueing ${typingsData.id.name}/v${formatDependencyVersion(typingsData.id.version)} due to system change`
      );
      return typingsData.id;
    }

    const changedPackages = await getChangedPackages({ diffTo: result.body.sourceVersion, definitelyTypedPath });
    if (!changedPackages) {
      return undefined;
    }

    if (changedPackages.some(packageIdsAreEqual(typingsData.id))) {
      // Package has changed; run it
      return typingsData.id;
    }

    return undefined;
  });

  const affectedPackages = getAffectedPackages(allPackages, compact(changedPackages));
  const packagesToBenchmark = [...affectedPackages.changedPackages, ...affectedPackages.dependentPackages];
  const groups = packagesToBenchmark.reduce((groups: PackageId[][], typingsData, index) => {
    const agentIndex = index % agentCount;
    if (groups[agentIndex]) {
      groups[agentIndex].push(typingsData.id);
    } else {
      groups[agentIndex] = [typingsData.id];
    }
    return groups;
  }, []);

  const benchmarkOptions: Partial<BenchmarkPackageOptions> = {
    definitelyTypedPath,
    tsVersion,
    upload: true
  };

  await writeFile(
    outFile,
    JSON.stringify(
      {
        changedPackageCount: affectedPackages.changedPackages.length,
        dependentPackageCount: affectedPackages.dependentPackages.length,
        totalPackageCount: packagesToBenchmark.length,
        system: currentSystem,
        options: benchmarkOptions,
        groups
      },
      undefined,
      2
    ),
    "utf8"
  );
}
