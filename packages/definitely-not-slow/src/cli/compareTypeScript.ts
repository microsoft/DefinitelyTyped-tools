import * as os from 'os';
import * as path from 'path';
import { PackageId, AllPackages } from "types-publisher/bin/lib/packages";
import { getDatabase, DatabaseAccessLevel, Document, PackageBenchmarkSummary, getChangedPackages, packageIdsAreEqual, getParsedPackages, config, toPackageKey, parsePackageKey, createDocument, Args, assertString, withDefault, assertNumber, assertDefined } from "../common";
import { Container, Response } from "@azure/cosmos";
import { FS } from "types-publisher/bin/get-definitely-typed";
import { benchmarkPackage } from "./benchmark";
import { getTypeScript } from '../measure/getTypeScript';
import { summarize } from '../measure';
import { postTypeScriptComparisonResults } from '../github/postTypeScriptComparisonResult';

export interface CompareTypeScriptOptions {
  compareAgainstMajorMinor: string;
  definitelyTypedPath: string;
  packages?: PackageId[];
  maxRunSeconds?: number;
  typeScriptPath?: string;
}

function convertArgs(args: Args): CompareTypeScriptOptions {
  return {
    compareAgainstMajorMinor: assertDefined(args.compareAgainstMajorMinor, 'compareAgainstMajorMinor').toString(),
    definitelyTypedPath: assertString(args.definitelyTypedPath, 'definitelyTypedPath'),
    typeScriptPath:  assertString(withDefault(args.typeScriptPath, path.resolve('built/local')), 'typeScriptPath'),
    packages: args.packages ? assertString(args.packages, 'packages').split(',').map(p => parsePackageKey(p.trim())) : undefined,
    maxRunSeconds: args.maxRunSeconds ? assertNumber(args.maxRunSeconds, 'maxRunSeconds') : undefined,
  };
}

export function compareTypeScriptCLI(args: Args) {
  return compareTypeScript(convertArgs(args));
}

export async function compareTypeScript({
  compareAgainstMajorMinor,
  definitelyTypedPath,
  packages,
  maxRunSeconds,
  typeScriptPath,
}: CompareTypeScriptOptions) {
  await getTypeScript(compareAgainstMajorMinor);
  const getAllPackages = createGetAllPackages(definitelyTypedPath);
  const { container } = await getDatabase(DatabaseAccessLevel.Read);
  const priorResults = await getPackagesToTestAndPriorResults(container, compareAgainstMajorMinor, definitelyTypedPath, getAllPackages, packages);
  const packagesToTest = packages ? packages.map(p => `${p.name}/v${p.majorVersion}`) : Array.from(priorResults.keys());
  const now = new Date();
  const comparisons: [Document<PackageBenchmarkSummary>, Document<PackageBenchmarkSummary>][] = [];
  for (const packageKey of packagesToTest) {
    const { name, majorVersion } = parsePackageKey(packageKey);
    let priorResult = priorResults.get(packageKey);
    if (!priorResult) {
      priorResult = createDocument(summarize((await benchmarkPackage(name, majorVersion.toString(), now, {
        definitelyTypedPath,
        iterations: config.benchmarks.languageServiceIterations,
        tsVersion: compareAgainstMajorMinor,
        nProcesses: os.cpus().length,
        printSummary: true,
        progress: false,
        upload: true,
        installTypeScript: false,
        maxRunSeconds,
      }))[0]), config.database.packageBenchmarksDocumentSchemaVersion);
    }

    const currentResult = createDocument(summarize((await benchmarkPackage(name, majorVersion.toString(), now, {
      definitelyTypedPath,
      iterations: config.benchmarks.languageServiceIterations,
      tsVersion: 'local',
      localTypeScriptPath: typeScriptPath,
      nProcesses: os.cpus().length,
      printSummary: true,
      progress: false,
      upload: true,
      installTypeScript: false,
      maxRunSeconds,
    }))[0]), config.database.packageBenchmarksDocumentSchemaVersion);
    
    comparisons.push([priorResult, currentResult]);
  }

  const comment = await postTypeScriptComparisonResults({ comparisons, dryRun: true });
  console.log(comment);
}

async function getPackagesToTestAndPriorResults(container: Container, typeScriptVersion: string, definitelyTypedPath: string, getAllPackages: ReturnType<typeof createGetAllPackages>, packageList?: PackageId[]) {
  const iterator: AsyncIterable<Response<Document<PackageBenchmarkSummary>>> = await container.items.query({
    query: `SELECT * FROM ${config.database.packageBenchmarksContainerId} b` +
    `  WHERE b.body.typeScriptVersionMajorMinor = @typeScriptVersion` +
    (packageList ?
      `  AND b.body.packageName IN (${packageList!.map(({ name }) => `"${name}"`).join(', ')})` // Couldn’t figure out how to do this with parameters
      : ''),
    parameters: [
      { name: '@typeScriptVersion', value: typeScriptVersion },
    ],
  }, {
    enableCrossPartitionQuery: true,
  }).getAsyncIterator();

  const packageKeys = packageList && packageList.map(toPackageKey);
  const packages = new Map<string, Document<PackageBenchmarkSummary>>();
  for await (const { result } of iterator) {
    if (!result) continue;
    const packageKey = toPackageKey(result.body.packageName, result.body.packageVersion);
    if (packageKeys && !packageKeys.includes(packageKey)) {
      continue;
    }

    const candidate = packages.get(packageKey);
    if (candidate && candidate.createdAt > result.createdAt) {
      continue;
    }

    const packageId = { name: result.body.packageName, majorVersion: parseInt(result.body.packageVersion, 10) || '*' as const };
    const changedPackages = await getChangedPackages({ diffTo: result.body.sourceVersion, definitelyTypedPath });
    if (changedPackages && changedPackages.some(packageIdsAreEqual(packageId))) {
      console.log(`Skipping ${packageKey} because it changed`);
      continue;
    } else if (!changedPackages) {
      packages.set(packageKey, result);
      continue;
    }

    const { allPackages } = await getAllPackages();
    const dependencies = allPackages.getTypingsData(packageId).dependencies;
    if (dependencies.some(dep => changedPackages.some(packageIdsAreEqual(dep)))) {
      console.log(`Skipping ${packageKey} because one or more of its dependencies changed`);
      continue;
    }

    packages.set(packageKey, result);
  }

  return packages;
}

function createGetAllPackages(definitelyTypedPath: string) {
  let result: { allPackages: AllPackages, definitelyTypedFS: FS } | undefined;
  return async () => {
    return result || (result = await getParsedPackages(definitelyTypedPath));
  };
}
