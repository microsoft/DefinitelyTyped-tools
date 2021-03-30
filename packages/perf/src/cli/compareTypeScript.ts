import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import {
  getDatabase,
  DatabaseAccessLevel,
  Document,
  PackageBenchmarkSummary,
  getChangedPackages,
  packageIdsAreEqual,
  getParsedPackages,
  config,
  toPackageKey,
  parsePackageKey,
  createDocument,
  assertString,
  getSystemInfo,
  systemsAreCloseEnough,
  JSONDocument,
  deserializeSummary,
  QueryResult,
  TypeScriptComparisonRun,
  getSourceVersion
} from "../common";
import { Container, FeedResponse } from "@azure/cosmos";
import { benchmarkPackage } from "./benchmark";
import { getTypeScript } from "../measure/getTypeScript";
import { postTypeScriptComparisonResults } from "../github/postTypeScriptComparisonResult";
import { insertDocument } from "../write";
import { PackageId, AllPackages, formatDependencyVersion } from "@definitelytyped/definitions-parser";
import { assertDefined } from "@definitelytyped/utils";
const writeFile = promisify(fs.writeFile);
const currentSystem = getSystemInfo();

export interface CompareTypeScriptOptions {
  compareAgainstVersion: string;
  definitelyTypedPath: string;
  packages?: PackageId[];
  maxRunSeconds?: number;
  localTypeScriptPath: string;
  outFile?: string;
  groups?: { [key: string]: QueryResult<JSONDocument<PackageBenchmarkSummary>> }[];
  agentCount?: number;
  agentIndex?: number;
  upload?: boolean;
}

export interface CompareTypeScriptCLIArgs {
  file?: string;
  compareAgainstVersion: string;
  definitelyTypedPath: string;
  localTypeScriptPath: string;
  maxRunSeconds?: number;
  outFile?: string;
  upload?: boolean;
  packages?: PackageId[];
}

function convertArgs({ file, ...args }: CompareTypeScriptCLIArgs): CompareTypeScriptOptions {
  if (file) {
    // tslint:disable-next-line:non-literal-require -- filename comes from Azure artifact
    const jsonContent = require(path.resolve(assertString(file, "file")));
    return {
      ...args,
      ...jsonContent.options,
      groups: jsonContent.groups
    };
  }

  return args;
}

export function compareTypeScriptCLI(args: CompareTypeScriptCLIArgs) {
  return compareTypeScript(convertArgs(args));
}

export async function compareTypeScript({
  compareAgainstVersion,
  definitelyTypedPath,
  packages,
  maxRunSeconds,
  localTypeScriptPath: typeScriptPath,
  upload,
  outFile,
  groups,
  ...opts
}: CompareTypeScriptOptions) {
  const { packageBenchmarks, typeScriptComparisons } = await getDatabase(
    upload && !outFile ? DatabaseAccessLevel.Write : DatabaseAccessLevel.Read
  );
  const agentIndex = groups && assertDefined(opts.agentIndex, "agentIndex");
  const priorResults = groups
    ? new Map<string, QueryResult<Document<PackageBenchmarkSummary>>>(
        Object.keys(groups[agentIndex!]).map(key => [key, deserializeSummary(groups[agentIndex!][key])] as const)
      )
    : await getPackagesToTestAndPriorResults(
        packageBenchmarks,
        compareAgainstVersion,
        definitelyTypedPath,
        (await getParsedPackages(definitelyTypedPath)).allPackages,
        packages
      );

  if (outFile) {
    const agentCount = assertDefined(opts.agentCount, "agentCount");
    const fileContent = JSON.stringify(
      {
        options: {
          compareAgainstVersion,
          definitelyTypedPath,
          maxRunSeconds,
          typeScriptPath,
          upload
        },
        groups: Array.from(priorResults.keys()).reduce((groups, key, index) => {
          const agentIndex = index % agentCount;
          if (groups[agentIndex]) {
            groups[agentIndex][key] = priorResults.get(key)!;
          } else {
            groups[agentIndex] = { [key]: priorResults.get(key)! };
          }
          return groups;
        }, [] as { [key: string]: Document<PackageBenchmarkSummary> }[])
      },
      undefined,
      2
    );

    return writeFile(outFile, fileContent, "utf8");
  }

  await getTypeScript(compareAgainstVersion);
  const packagesToTest = packages
    ? packages.map(p => `${p.name}/v${formatDependencyVersion(p.version)}`)
    : Array.from(priorResults.keys());
  const now = new Date();
  const comparisons: [Document<PackageBenchmarkSummary>, Document<PackageBenchmarkSummary>][] = [];
  for (const packageKey of packagesToTest) {
    const { name, version } = parsePackageKey(packageKey);
    let priorResult:
      | Document<PackageBenchmarkSummary>
      | QueryResult<Document<PackageBenchmarkSummary>>
      | undefined = priorResults.get(packageKey);
    const priorResultId = priorResult && "id" in priorResult && priorResult.id;
    if (priorResult) {
      if (!systemsAreCloseEnough(currentSystem, priorResult.system)) {
        console.log(`Skipping ${packageKey} because the system is too different`);
        continue;
      }
    } else {
      const benchmark = await benchmarkPackage(name, formatDependencyVersion(version), now, {
        definitelyTypedPath,
        iterations: config.benchmarks.languageServiceIterations,
        tsVersion: compareAgainstVersion,
        nProcesses: os.cpus().length,
        printSummary: true,
        progress: false,
        upload: !!upload,
        installTypeScript: false,
        failOnErrors: false,
        maxRunSeconds
      });

      if (!benchmark) {
        console.log(`Skipping ${packageKey} because it was deleted`);
        continue;
      }

      priorResult = {
        id: benchmark.id,
        ...createDocument(benchmark.summary, config.database.packageBenchmarksDocumentSchemaVersion)
      };
    }

    const currentResult = createDocument(
      (await benchmarkPackage(name, formatDependencyVersion(version), now, {
        definitelyTypedPath,
        iterations: config.benchmarks.languageServiceIterations,
        tsVersion: "local",
        localTypeScriptPath: typeScriptPath,
        nProcesses: os.cpus().length,
        printSummary: true,
        progress: false,
        upload: false,
        installTypeScript: false,
        failOnErrors: false,
        maxRunSeconds
      }))!.summary,
      config.database.packageBenchmarksDocumentSchemaVersion
    );

    comparisons.push([priorResult!, currentResult]);
    if (upload && priorResultId) {
      const comparison: TypeScriptComparisonRun = {
        sourceVersion: getSourceVersion(typeScriptPath),
        compareAgainstPackageBenchmarkId: priorResultId,
        headBenchmark: currentResult.body
      };
      await insertDocument(
        comparison,
        config.database.typeScriptComparisonsDocumentSchemaVersion,
        typeScriptComparisons
      );
    }
  }

  const comment = await postTypeScriptComparisonResults({ comparisons, dryRun: true });
  console.log(comment);
}

async function getPackagesToTestAndPriorResults(
  container: Container,
  typeScriptVersion: string,
  definitelyTypedPath: string,
  allPackages: AllPackages,
  packageList?: PackageId[]
) {
  const iterator: AsyncIterable<FeedResponse<QueryResult<Document<PackageBenchmarkSummary>>>> = await container.items
    .query({
      query:
        `SELECT * FROM ${config.database.packageBenchmarksContainerId} b` +
        `  WHERE b.body.typeScriptVersionMajorMinor = @typeScriptVersion` +
        (packageList
          ? `  AND b.body.packageName IN (${packageList!.map(({ name }) => `"${name}"`).join(", ")})` // Couldn’t figure out how to do this with parameters
          : ""),
      parameters: [{ name: "@typeScriptVersion", value: typeScriptVersion }]
    })
    .getAsyncIterator();

  const packageKeys = packageList && packageList.map(id => toPackageKey(allPackages.resolve(id)));
  const packages = new Map<string, QueryResult<Document<PackageBenchmarkSummary>>>();

  for await (const x of iterator) {
    for (const result of x.resources) {
      if (!result) continue;
      const packageKey = toPackageKey(result.body);
      if (packageKeys && !packageKeys.includes(packageKey)) {
        continue;
      }

      const candidate = packages.get(packageKey);
      if (candidate && candidate.createdAt > result.createdAt) {
        continue;
      }

      const packageId: PackageId = {
        name: result.body.packageName,
        version: { major: result.body.packageVersionMajor, minor: result.body.packageVersionMinor }
      };
      const changedPackages = await getChangedPackages({ diffTo: result.body.sourceVersion, definitelyTypedPath });
      if (changedPackages && changedPackages.some(packageIdsAreEqual(packageId))) {
        console.log(`Skipping ${packageKey} because it changed`);
        continue;
      } else if (changedPackages) {
        const dependencies = allPackages.getTypingsData(packageId).dependencies;
        if (
          Object.entries(dependencies).some(([name, version]) =>
            changedPackages.some(packageIdsAreEqual({ name, version }))
          )
        ) {
          console.log(`Skipping ${packageKey} because one or more of its dependencies changed`);
          continue;
        }
      }

      packages.set(packageKey, result);
    }
  }

  return packages;
}
