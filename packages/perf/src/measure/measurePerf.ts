import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { PerformanceObserver, performance } from "perf_hooks";
import { Node, SourceFile, Extension, CompilerOptions } from "typescript";
import { LanguageServiceBenchmark, PackageBenchmark, LanguageServiceSingleMeasurement, toPackageKey } from "../common";
import { installDependencies } from "./installDependencies";
import { getParsedCommandLineForPackage } from "./getParsedCommandLineForPackage";
import {
  measureLanguageServiceWorkerFilename,
  MeasureLanguageServiceChildProcessArgs
} from "./measureLanguageServiceWorker";
import {
  MeasureBatchCompilationChildProcessArgs,
  measureBatchCompilationWorkerFilename,
  MeasureBatchCompilationChildProcessResult
} from "./measureBatchCompilationWorker";
import { AllPackages, formatDependencyVersion, TypingVersion } from "@definitelytyped/definitions-parser";
import { runWithListeningChildProcesses, runWithChildProcesses, Semver } from "@definitelytyped/utils";

export interface MeasurePerfOptions {
  packageName: string;
  packageVersion: TypingVersion;
  typeScriptVersion: string;
  definitelyTypedRootPath: string;
  maxRunSeconds?: number;
  progress?: boolean;
  nProcesses: number;
  iterations: number;
  allPackages: AllPackages;
  tsPath: string;
  ts: typeof import("typescript");
  batchRunStart: Date;
  failOnErrors?: boolean;
}

export async function measurePerf({
  packageName,
  packageVersion,
  typeScriptVersion,
  definitelyTypedRootPath,
  allPackages,
  maxRunSeconds = Infinity,
  progress,
  nProcesses,
  iterations,
  tsPath,
  ts,
  batchRunStart,
  failOnErrors
}: MeasurePerfOptions) {
  let duration = NaN;
  const sourceVersion = execSync("git rev-parse HEAD", { cwd: definitelyTypedRootPath, encoding: "utf8" }).trim();
  const observer = new PerformanceObserver(list => {
    const totalMeasurement = list.getEntriesByName("benchmark")[0];
    duration = totalMeasurement.duration;
  });

  observer.observe({ entryTypes: ["measure"] });
  performance.mark("benchmarkStart");
  const typesPath = path.join(definitelyTypedRootPath, "types");

  const typings = allPackages.getTypingsData({
    name: packageName,
    version: packageVersion
  });
  const packagePath = path.join(typesPath, typings.subDirectoryPath);
  const typesVersion = getLatestTypesVersionForTypeScriptVersion(typings.typesVersions, typeScriptVersion);
  const latestTSTypesDir = path.resolve(packagePath, typesVersion ? `ts${typesVersion}` : ".");
  await installDependencies(allPackages, typings.id, typesPath);

  const commandLine = getParsedCommandLineForPackage(ts, latestTSTypesDir);
  const testPaths = getTestFileNames(commandLine.fileNames);

  let done = 0;
  let lastUpdate = Date.now();
  let languageServiceCrashed = false;
  const testMatrix = createLanguageServiceTestMatrix(testPaths, latestTSTypesDir, commandLine.options, iterations);
  if (progress) {
    updateProgress(
      `${toPackageKey(packageName, packageVersion)}: benchmarking over ${nProcesses} processes`,
      0,
      testMatrix.inputs.length
    );
  }

  await runWithListeningChildProcesses({
    inputs: testMatrix.inputs,
    commandLineArgs: [],
    workerFile: measureLanguageServiceWorkerFilename,
    nProcesses,
    crashRecovery: !failOnErrors,
    cwd: process.cwd(),
    softTimeoutMs: maxRunSeconds * 1000,
    handleCrash: input => {
      languageServiceCrashed = true;
      console.error("Failed measurement on request:", JSON.stringify(input, undefined, 2));
    },
    handleOutput: (measurement: LanguageServiceSingleMeasurement) => {
      testMatrix.addMeasurement(measurement);
      done++;
      if (progress) {
        updateProgress(
          `${toPackageKey(packageName, packageVersion)}: benchmarking over ${nProcesses} processes`,
          done,
          testMatrix.inputs.length
        );
      } else if (Date.now() - lastUpdate > 1000 * 60 * 5) {
        // Log every 5 minutes or so to make sure Pipelines doesn’t shut us down
        console.log(((100 * done) / testMatrix.inputs.length).toFixed(1) + "% done...");
        lastUpdate = Date.now();
      }
    }
  });

  if (progress && done !== testMatrix.inputs.length) {
    updateProgress(`${toPackageKey(packageName, packageVersion)}: timed out`, done, testMatrix.inputs.length);
    process.stdout.write(os.EOL);
  }

  const batchCompilationInput: MeasureBatchCompilationChildProcessArgs = {
    tsPath,
    fileNames: commandLine.fileNames,
    options: commandLine.options
  };

  let batchCompilationResult: MeasureBatchCompilationChildProcessResult | undefined;
  await runWithChildProcesses({
    inputs: [batchCompilationInput],
    workerFile: measureBatchCompilationWorkerFilename,
    commandLineArgs: [],
    nProcesses: 1,
    handleOutput: (result: MeasureBatchCompilationChildProcessResult) => {
      batchCompilationResult = result;
    }
  });

  if (!batchCompilationResult) {
    throw new Error("Failed to get batch compilation metrics");
  }

  performance.mark("benchmarkEnd");
  performance.measure("benchmark", "benchmarkStart", "benchmarkEnd");

  const measurement: PackageBenchmark = {
    ...batchCompilationResult,
    benchmarkDuration: duration,
    sourceVersion,
    packageName,
    packageVersion: formatDependencyVersion(packageVersion),
    typeScriptVersion,
    typeScriptVersionMajorMinor: ts.versionMajorMinor,
    languageServiceBenchmarks: testMatrix.getAllBenchmarks(),
    requestedLanguageServiceTestIterations: iterations,
    languageServiceCrashed,
    testIdentifierCount: testMatrix.uniquePositionCount,
    batchRunStart
  };

  return measurement;

  function getIdentifiers(sourceFile: SourceFile) {
    const identifiers: Node[] = [];
    ts.forEachChild(sourceFile, function visit(node) {
      if (ts.isIdentifier(node)) {
        identifiers.push(node);
      } else {
        ts.forEachChild(node, visit);
      }
    });
    return identifiers;
  }

  function getTestFileNames(fileNames: readonly string[]) {
    return fileNames.filter(name => {
      const ext = path.extname(name);
      return (ext === Extension.Ts || ext === Extension.Tsx) && !name.endsWith(Extension.Dts);
    });
  }

  function createLanguageServiceTestMatrix(
    testPaths: string[],
    packageDirectory: string,
    compilerOptions: CompilerOptions,
    iterations: number
  ) {
    const fileMap = new Map<string, Map<number, LanguageServiceBenchmark>>();
    const inputs: MeasureLanguageServiceChildProcessArgs[] = [];
    let uniquePositionCount = 0;
    for (const testPath of testPaths) {
      const positionMap = new Map<number, LanguageServiceBenchmark>();
      fileMap.set(testPath, positionMap);
      const sourceFile = ts.createSourceFile(
        testPath,
        ts.sys.readFile(testPath)!,
        compilerOptions.target || ts.ScriptTarget.Latest
      );
      // Reverse: more complex examples are usually near the end of test files,
      // so prioritize those.
      const identifiers = getIdentifiers(sourceFile).reverse();
      uniquePositionCount += identifiers.length;
      // Do the loops in this order so that a single child process doesn’t
      // run iterations of the same exact measurement back-to-back to avoid
      // v8 optimizing a significant chunk of the work away.
      for (let i = 0; i < iterations; i++) {
        for (const identifier of identifiers) {
          const start = identifier.getStart(sourceFile);
          if (i === 0) {
            const lineAndCharacter = ts.getLineAndCharacterOfPosition(sourceFile, start);
            const benchmark: LanguageServiceBenchmark = {
              fileName: path.relative(definitelyTypedRootPath, testPath),
              start,
              end: identifier.getEnd(),
              identifierText: identifier.getText(sourceFile),
              line: lineAndCharacter.line + 1,
              offset: lineAndCharacter.character + 1,
              completionsDurations: [],
              quickInfoDurations: []
            };
            positionMap.set(start, benchmark);
          }
          inputs.push({
            fileName: testPath,
            start,
            packageDirectory,
            tsPath
          });
        }
      }
    }
    return {
      inputs,
      uniquePositionCount,
      addMeasurement: (measurement: LanguageServiceSingleMeasurement) => {
        const benchmark = fileMap.get(measurement.fileName)!.get(measurement.start)!;
        benchmark.completionsDurations.push(measurement.completionsDuration);
        benchmark.quickInfoDurations.push(measurement.quickInfoDuration);
      },
      getAllBenchmarks: () => {
        return Array.prototype.concat
          .apply(
            [],
            Array.from(fileMap.values()).map(map => Array.from(map.values()))
          )
          .filter(
            (benchmark: LanguageServiceBenchmark) =>
              benchmark.completionsDurations.length > 0 || benchmark.quickInfoDurations.length > 0
          );
      }
    };
  }
}

function getLatestTypesVersionForTypeScriptVersion(
  typesVersions: readonly string[],
  typeScriptVersion: string
): string | undefined {
  const tsVersion = Semver.parse(typeScriptVersion.replace(/-dev.*$/, ""));
  for (let i = typesVersions.length - 1; i > 0; i--) {
    const [major, minor] = typesVersions[i].split(".").map(Number); // e.g. '3.5'
    const typesVersion = new Semver(major, minor, 0);
    if (tsVersion.greaterThan(typesVersion)) {
      return typesVersions[i];
    }
  }
  return;
}

function updateProgress(text: string, done: number, total: number) {
  const padDigits = total.toString().length - done.toString().length;
  if (done === total) {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${text} (✔)`);
      process.stdout.write(os.EOL);
    }
  } else if (!done) {
    process.stdout.write(`${text}`);
  } else if (process.stdout.clearLine && process.stdout.cursorTo) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${text} ${" ".repeat(padDigits)}(${done}/${total} trials)`);
  }
}
