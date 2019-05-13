import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { getDatabase, getParsedPackages, DatabaseAccessLevel, config, Document, PackageBenchmarkSummary, compact, Args, assertNumber, assertString, getSystemInfo } from '../common';
import { nAtATime, execAndThrowErrors } from 'types-publisher/bin/util/util';
import { gitChanges } from 'types-publisher/bin/tester/test-runner';
import { getAffectedPackages } from 'types-publisher/bin/tester/get-affected-packages';
import { PackageId } from 'types-publisher/bin/lib/packages';
import { BenchmarkPackageOptions } from './benchmark';
const writeFile = promisify(fs.writeFile);
const currentSystem = getSystemInfo();

export interface GetPackagesToBenchmarkOptions {
  definitelyTypedPath: string;
  typeScriptVersionMajorMinor: string;
  agentCount: number;
  outFile: string;
}

function convertArgs(args: Args): GetPackagesToBenchmarkOptions {
  const tsVersion = (args.typeScriptVersion || '').toString();
  if (tsVersion.split('.').length !== 2) {
    throw new Error(`Argument 'typeScriptVersion' must be in format 'major.minor' (e.g. '3.1')`);
  }
  const dtPath = assertString(args.definitelyTypedPath || process.cwd(), 'definitelyTypedPath');
  const definitelyTypedPath = path.isAbsolute(dtPath) ? dtPath : path.resolve(process.cwd(), dtPath);
  return {
    definitelyTypedPath,
    agentCount: assertNumber(args.agentCount, 'agentCount'),
    typeScriptVersionMajorMinor: tsVersion,
    outFile: assertString(args.outFile, 'outFile'),
  };
}

export async function getPackagesToBenchmark(args: Args) {
  const {
    definitelyTypedPath,
    agentCount,
    typeScriptVersionMajorMinor,
    outFile,
  } = convertArgs(args);
  const { allPackages } = await getParsedPackages(definitelyTypedPath);
  const { container } = await getDatabase(DatabaseAccessLevel.Read);
  const changedPackages = await nAtATime(10, allPackages.allTypings(), async typingsData => {
    const response = await container.items.query({
      query:
        `SELECT TOP 1 * FROM ${config.database.packageBenchmarksContainerId} b` +
        `  WHERE b.body.packageName = @packageName` +
        `  AND b.body.packageVersion = @packageVersion` +
        `  AND b.body.typeScriptVersionMajorMinor = @tsVersion` +
        `  ORDER BY b.createdAt DESC`,
      parameters: [
        { name: '@packageName', value: typingsData.id.name },
        { name: '@packageVersion', value: typingsData.id.majorVersion.toString() },
        { name: '@tsVersion', value: typeScriptVersionMajorMinor },
      ],
    }, { enableCrossPartitionQuery: true }).current();

    // No previous run exists; run one
    if (!response.result) {
      return typingsData.id;
    }

    const result: Document<PackageBenchmarkSummary> = response.result;
    
    // System specs are different; run it
    if (result.system.hash !== currentSystem.hash) {
      console.log(`Queueing ${typingsData.id.name}/${typingsData.id.majorVersion} due to system change`);
      return typingsData.id;
    }

    const diff = await execAndThrowErrors(`git diff --name-status ${result.body.sourceVersion}`, definitelyTypedPath);
    if (!diff) {
      return undefined;
    }

    const changes = diff.split('\n').map(line => {
      const [status, file] = line.split(/\s+/, 2);
      return { status: status.trim() as 'A' | 'D' | 'M', file: file.trim() };
    });

    const changedPackages = await gitChanges(changes);
    if (changedPackages.some(changedPackage => changedPackage.name === typingsData.id.name && changedPackage.majorVersion === typingsData.id.majorVersion)) {
      // Package has changed; run it
      return typingsData.id;
    }
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
    tsVersion: typeScriptVersionMajorMinor,
    upload: true,
  }

  await writeFile(outFile, JSON.stringify({
    changedPackageCount: affectedPackages.changedPackages.length,
    dependentPackageCount: affectedPackages.dependentPackages.length,
    totalPackageCount: packagesToBenchmark.length,
    system: currentSystem,
    options: benchmarkOptions,
    groups,
  }, undefined, 2), 'utf8');
}
