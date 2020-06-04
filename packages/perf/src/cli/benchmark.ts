import * as os from "os";
import * as path from "path";
import {
  getDatabase,
  DatabaseAccessLevel,
  config,
  getParsedPackages,
  assertString,
  assertBoolean,
  withDefault,
  assertNumber,
  getSystemInfo,
  Args
} from "../common";
import { getTypeScript } from "../measure/getTypeScript";
import { insertDocument } from "../write";
import { printSummary, measurePerf } from "../measure";
import { summarize } from "../analysis";
import { PackageId, formatDependencyVersion, parseVersionFromDirectoryName } from "@definitelytyped/definitions-parser";
const currentSystem = getSystemInfo();

export interface BenchmarkPackageOptions {
  groups?: PackageId[][];
  agentIndex?: number;
  package?: string;
  upload: boolean;
  tsVersion: string;
  progress: boolean;
  iterations: number;
  nProcesses: number;
  maxRunSeconds?: number;
  printSummary: boolean;
  definitelyTypedPath: string;
  failOnErrors?: boolean;
  installTypeScript?: boolean;
  localTypeScriptPath?: string;
  reverse?: boolean;
}

function convertArgs({ file, ...args }: Args): BenchmarkPackageOptions {
  if (file) {
    // tslint:disable-next-line:non-literal-require -- filename comes from Azure artifact
    const fileContents = require(path.resolve(assertString(file, "file")));
    if (fileContents.system.hash !== currentSystem.hash) {
      console.warn("Systems mismatch; requested:");
      console.warn(JSON.stringify(fileContents.system, undefined, 2) + os.EOL);
      console.warn("Current:");
      console.warn(JSON.stringify(currentSystem, undefined, 2) + os.EOL);
    }
    return {
      groups: fileContents.groups,
      ...convertArgs({ ...fileContents.options, ...args }),
      failOnErrors: false
    };
  }

  return {
    package: args.package ? assertString(args.package) : undefined,
    agentIndex: args.agentIndex !== undefined ? assertNumber(args.agentIndex, "agentIndex") : undefined,
    upload: assertBoolean(withDefault(args.upload, true), "upload"),
    tsVersion: withDefault(args.tsVersion, "next").toString(),
    progress: assertBoolean(withDefault(args.progress, false), "progress"),
    iterations: assertNumber(withDefault(args.iterations, 5), "iterations"),
    nProcesses: assertNumber(withDefault(args.nProcesses, os.cpus().length), "nProcesses"),
    maxRunSeconds: args.maxRunSeconds ? assertNumber(args.maxRunSeconds, "maxRunSeconds") : undefined,
    printSummary: assertBoolean(withDefault(args.printSummary, true), "printSummary"),
    definitelyTypedPath: path.resolve(
      assertString(withDefault(args.definitelyTypedPath, process.cwd()), "definitelyTypedPath")
    ),
    failOnErrors: true,
    installTypeScript: true,
    localTypeScriptPath: assertString(
      withDefault(args.localTypeScriptPath, path.resolve("built/local")),
      "localTypeScriptPath"
    ),
    reverse: !!args.reverse
  };
}

export async function benchmark(args: Args) {
  const options = convertArgs(args);
  const time = new Date();
  if (options.groups) {
    let group = options.groups[assertNumber(options.agentIndex, "agentIndex")];
    if (options.reverse) {
      group = group.reverse();
    }

    for (let i = 0; i < group.length; i++) {
      const packageId = group[i];
      const logString =
        `Benchmarking ${packageId.name}/${formatDependencyVersion(packageId.version)} ` +
        `(${i + 1} of ${group.length})`;
      console.log(logString);
      console.log("=".repeat(logString.length) + os.EOL);
      await benchmarkPackage(packageId.name, formatDependencyVersion(packageId.version), time, options);
    }
  } else {
    const [packageName, packageVersion] = assertString(options.package, "package").split("/");
    await benchmarkPackage(packageName, packageVersion, time, options);
  }
}

export async function benchmarkPackage(
  packageName: string,
  packageVersion: string | undefined,
  batchRunStart: Date,
  options: BenchmarkPackageOptions
) {
  const {
    upload,
    progress,
    iterations,
    nProcesses,
    tsVersion,
    maxRunSeconds,
    printSummary: shouldPrintSummary,
    definitelyTypedPath,
    failOnErrors,
    installTypeScript,
    localTypeScriptPath
  } = options;
  const version = parseVersionFromDirectoryName(packageVersion) || "*";
  const { allPackages } = await getParsedPackages(definitelyTypedPath);
  if (!allPackages.tryGetTypingsData({ name: packageName, version })) {
    return undefined;
  }

  const { ts, tsPath } = await getTypeScript(tsVersion.toString(), localTypeScriptPath, installTypeScript);
  const benchmark = await measurePerf({
    packageName,
    packageVersion: version.toString(),
    allPackages,
    iterations,
    progress,
    definitelyTypedRootPath: definitelyTypedPath,
    typeScriptVersion: ts.version,
    maxRunSeconds,
    nProcesses,
    tsPath,
    ts,
    batchRunStart,
    failOnErrors
  });

  const summary = summarize(benchmark);

  if (shouldPrintSummary) {
    printSummary([summary]);
  }

  if (upload) {
    const { packageBenchmarks } = await getDatabase(DatabaseAccessLevel.Write);
    const item = await insertDocument(
      summary,
      config.database.packageBenchmarksDocumentSchemaVersion,
      packageBenchmarks
    );

    return { benchmark, summary, id: item.id };
  }

  return { benchmark, summary, id: undefined };
}
