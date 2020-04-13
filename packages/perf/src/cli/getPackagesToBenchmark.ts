import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { getDatabase, getParsedPackages, DatabaseAccessLevel, compact, Args, assertNumber, assertString, getSystemInfo, getChangedPackages, packageIdsAreEqual, systemsAreCloseEnough } from '../common';
import { nAtATime } from 'types-publisher/bin/util/util';
import { getAffectedPackages } from 'types-publisher/bin/tester/get-affected-packages';
import { PackageId } from 'types-publisher/bin/lib/packages';
import { BenchmarkPackageOptions } from './benchmark';
import { getLatestBenchmark } from '../query';
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
  const { packageBenchmarks: container } = await getDatabase(DatabaseAccessLevel.Read);
  const changedPackages = await nAtATime(10, allPackages.allTypings(), async typingsData => {
    const result = await getLatestBenchmark({
      container,
      typeScriptVersionMajorMinor,
      packageName: typingsData.id.name,
      packageVersion: typingsData.id.majorVersion,
    });

    // No previous run exists; run one
    if (!result) {
      return typingsData.id;
    }
    
    // System specs are different; run it
    if (!systemsAreCloseEnough(result.system, currentSystem)) {
      console.log(`Queueing ${typingsData.id.name}/${typingsData.id.majorVersion} due to system change`);
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
