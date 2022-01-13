import * as os from "os";
import * as path from "path";
import { getParsedPackages, assertString, assertNumber, getSystemInfo } from "../common";
import { getTypeScript } from "../measure/getTypeScript";
import { printSummary, measurePerf } from "../measure";
import { summarize } from "../analysis";
import { PackageId, formatDependencyVersion, tryParsePackageVersion, AllPackages } from "@definitelytyped/definitions-parser";
const currentSystem = getSystemInfo();

export interface BenchmarkPackageOptions {
  allPackages?: AllPackages;
  file?: string;
  groups?: PackageId[][];
  agentIndex?: number;
  package?: string;
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

function convertArgs({ file, ...args }: BenchmarkPackageOptions): BenchmarkPackageOptions {
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
      ...fileContents.options,
      ...args,
      failOnErrors: false
    };
  }

  return args;
}

export async function benchmark(args: BenchmarkPackageOptions) {
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
    progress,
    iterations,
    nProcesses,
    tsVersion,
    maxRunSeconds,
    printSummary: shouldPrintSummary,
    definitelyTypedPath,
    failOnErrors,
    installTypeScript,
    localTypeScriptPath,
    allPackages = (await getParsedPackages(definitelyTypedPath)).allPackages,
  } = options;
  const versionQuery = tryParsePackageVersion(packageVersion);
  const typings = allPackages.tryGetTypingsData({ name: packageName, version: versionQuery });
  if (!typings) {
    return undefined;
  }

  const { ts, tsPath } = await getTypeScript(tsVersion.toString(), localTypeScriptPath, installTypeScript);
  const benchmark = await measurePerf({
    packageName,
    packageVersion: typings.id.version,
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

  return { benchmark, summary, id: undefined };
}
