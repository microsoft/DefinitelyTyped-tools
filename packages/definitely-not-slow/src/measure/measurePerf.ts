import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { PerformanceObserver, performance } from 'perf_hooks';
import { FS } from 'types-publisher/bin/get-definitely-typed';
import { getTypingInfo } from 'types-publisher/bin/lib/definition-parser';
import { AllPackages } from 'types-publisher/bin/lib/packages';
import { Semver } from 'types-publisher/bin/lib/versions';
import { Node, SourceFile, Extension, CompilerOptions } from 'typescript';
import { LanguageServiceBenchmark, PackageBenchmark, LanguageServiceSingleMeasurement, runInChildProcesses } from '../common';
import { installDependencies } from './installDependencies';
import { getParsedCommandLineForPackage } from './getParsedCommandLineForPackage';
import { formatDiagnosticsHost } from './formatDiagnosticsHost';
import { measureLanguageServiceWorkerFilename, MeasureLanguageServiceChildProcessArgs } from './measureLanguageServiceWorker';

export interface MeasurePerfOptions {
  packageName: string;
  packageVersion?: string;
  typeScriptVersion: string;
  definitelyTypedRootPath: string;
  definitelyTypedFS: FS;
  maxLanguageServiceTestPositions?: number;
  progress?: boolean;
  nProcesses: number;
  iterations: number;
  allPackages: AllPackages;
  tsPath: string;
  ts: typeof import('typescript');
  batchRunStart: Date;
}

export async function measurePerf({
  packageName,
  packageVersion,
  typeScriptVersion,
  definitelyTypedRootPath,
  definitelyTypedFS,
  allPackages,
  maxLanguageServiceTestPositions,
  progress,
  nProcesses,
  iterations,
  tsPath,
  ts,
  batchRunStart,
}: MeasurePerfOptions) {
  let duration = NaN;
  const sourceVersion = execSync('git rev-parse HEAD', { cwd: definitelyTypedRootPath, encoding: 'utf8' });
  const observer = new PerformanceObserver(list => {
    const totalMeasurement = list.getEntriesByName('benchmark')[0];
    duration = totalMeasurement.duration;
  });

  observer.observe({ entryTypes: ['measure'] });
  performance.mark('benchmarkStart');
  const typesPath = path.join(definitelyTypedRootPath, 'types');
  const packageFS = definitelyTypedFS.subDir(`types/${packageName}`);
  const typingsInfo = await getTypingInfo(packageName, packageFS);
  const benchmarks: PackageBenchmark[] = [];

  for (const version in typingsInfo) {
    if (packageVersion && version !== packageVersion) {
      continue;
    }
    const typings = allPackages.getTypingsData({ name: packageName, majorVersion: parseInt(version, 10) || '*'  });
    const packagePath = path.join(typesPath, typings.subDirectoryPath);
    const typesVersion = getLatestTypesVersionForTypeScriptVersion(typings.typesVersions, typeScriptVersion);
    const latestTSTypesDir = path.resolve(packagePath, typesVersion ? `ts${typesVersion}` : '.');
    await installDependencies(allPackages, typings.id, typesPath);
    
    const commandLine = getParsedCommandLineForPackage(ts, latestTSTypesDir);
    const testPaths = getTestFileNames(commandLine.fileNames);

    let done = 0;
    const testMatrix = createLanguageServiceTestMatrix(testPaths, latestTSTypesDir, commandLine.options, iterations);
    if (progress) {
      updateProgress(`v${version}: benchmarking over ${nProcesses} processes`, 0, testMatrix.inputs.length);
    }
    await runInChildProcesses({
      inputs: testMatrix.inputs,
      workerFile: measureLanguageServiceWorkerFilename,
      nParallel: nProcesses,
      execArgv: (_, index) => process.execArgv.concat(['--prof', `--logfile=logs/v8-prof-${index}.log`, '--no-logfile-per-isolate']),
      handleOutput: (measurement: LanguageServiceSingleMeasurement, _, index) => {
        testMatrix.addMeasurement(measurement);
        if (progress) {
          updateProgress(
            `v${version}: benchmarking over ${nProcesses} processes`,
            ++done,
            testMatrix.inputs.length);
        }
      },
    });

    const program = ts.createProgram({ rootNames: commandLine.fileNames, options: commandLine.options });
    const diagnostics = program.getSemanticDiagnostics().filter(diagnostic => {
      return diagnostic.code === 2307; // Cannot find module
    });
    if (diagnostics.length) {
      console.log(ts.formatDiagnostics(diagnostics, formatDiagnosticsHost));
      throw new Error('Compilation had errors');
    }

    const measurement: PackageBenchmark = {
      benchmarkDuration: duration,
      sourceVersion,
      packageName,
      packageVersion: version,
      typeScriptVersion,
      typeScriptVersionMajorMinor: ts.versionMajorMinor,
      typeCount: (program as any).getTypeCount(),
      relationCacheSizes: (program as any).getRelationCacheSizes && (program as any).getRelationCacheSizes(),
      languageServiceBenchmarks: testMatrix.getAllBenchmarks(),
      batchRunStart,
    };

    benchmarks.push(measurement);
  }

  performance.mark('benchmarkEnd');
  performance.measure('benchmark', 'benchmarkStart', 'benchmarkEnd');
  benchmarks.forEach(benchmark => benchmark.benchmarkDuration = duration);

  if (!benchmarks.length) {
    throw new Error(`No v${packageVersion} found for package ${packageName}.`);
  }
  return benchmarks;

  function getIdentifiers(sourceFile: SourceFile) {
    const identifiers: Node[] = [];
    ts.forEachChild(sourceFile, function visit(node) {
      if (ts.isIdentifier(node)) {
        identifiers.push(node);
      }
      else {
        ts.forEachChild(node, visit);
      }
    });
    return identifiers;
  }

  function getTestFileNames(fileNames: readonly string[]) {
    return fileNames.filter(name => {
      const ext = path.extname(name);
      return (ext === Extension.Ts || ext === Extension.Tsx)  && !name.endsWith(Extension.Dts);
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
    for (const testPath of testPaths) {
      const positionMap = new Map<number, LanguageServiceBenchmark>();
      fileMap.set(testPath, positionMap);
      const sourceFile = ts.createSourceFile(
        testPath,
        ts.sys.readFile(testPath)!,
        compilerOptions.target || ts.ScriptTarget.Latest);
      const identifiers = sampleIdentifiers(getIdentifiers(sourceFile), maxLanguageServiceTestPositions);
      // Do the loops in this order so that a single child process doesn’t
      // run iterations of the same exact measurement back-to-back to avoid
      // v8 optimizing a significant chunk of the work away.
      for (let i = 0; i < iterations; i++) {
        for (const identifier of identifiers) {
          const start = identifier.getStart(sourceFile);
          if (i === 0) {
            const lineAndCharacter = ts.getLineAndCharacterOfPosition(sourceFile, start);
            const benchmark: LanguageServiceBenchmark = {
              fileName: testPath,
              start,
              end: identifier.getEnd(),
              identifierText: identifier.getText(sourceFile),
              line: lineAndCharacter.line + 1,
              offset: lineAndCharacter.character + 1,
              completionsDurations: [],
              quickInfoDurations: [],
            };
            positionMap.set(start, benchmark);
          }
          inputs.push({
            fileName: testPath,
            start,
            packageDirectory,
            tsPath,
          });
        }
      }
    }
    return {
      inputs,
      addMeasurement: (measurement: LanguageServiceSingleMeasurement) => {
        const benchmark = fileMap.get(measurement.fileName)!.get(measurement.start)!;
        benchmark.completionsDurations.push(measurement.completionsDuration);
        benchmark.quickInfoDurations.push(measurement.quickInfoDuration);
      },
      getAllBenchmarks: () => {
        return Array.prototype.concat.apply([], Array.from(fileMap.values()).map(map => Array.from(map.values())));
      },
    };
  }
}


function sampleIdentifiers<T>(identifiers: T[], maxLanguageServiceTestPositions?: number): T[] {
  if (!maxLanguageServiceTestPositions || identifiers.length <= maxLanguageServiceTestPositions) {
    return identifiers;
  }

  // 5% at beginning, 20% at end, 75% evenly distributed through middle
  const beginningIdentifiersCount = Math.round(.05 * maxLanguageServiceTestPositions);
  const endIdentifiersCount = Math.round(0.2 * maxLanguageServiceTestPositions);
  const middleIdentifiersCount = Math.round(
    maxLanguageServiceTestPositions
    - beginningIdentifiersCount
    - endIdentifiersCount);
  const middleStartIndex = beginningIdentifiersCount;
  const middleEndIndex = identifiers.length - endIdentifiersCount - 1;
  const middleInterval = Math.ceil((middleEndIndex - middleStartIndex) / middleIdentifiersCount);
  return [
    ...identifiers.slice(0, beginningIdentifiersCount),
    ...identifiers.slice(middleStartIndex, middleEndIndex + 1).filter((_, i) => i % middleInterval === 0),
    ...identifiers.slice(middleEndIndex + 1),
  ];
}

function getLatestTypesVersionForTypeScriptVersion(typesVersions: readonly string[], typeScriptVersion: string): string | undefined {
  const tsVersion = Semver.parse(typeScriptVersion.replace(/-dev.*$/, ''));
  for (let i = typesVersions.length - 1; i > 0; i--) {
    const typesVersion = Semver.parse(typesVersions[i]);
    if (tsVersion.greaterThan(typesVersion)) {
      return typesVersions[i];
    }
  }
}

function updateProgress(text: string, done: number, total: number) {
  const padDigits = total.toString().length - done.toString().length;
  if (done === total) {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`${text} (✔)`);
      process.stdout.write(os.EOL);
    }
  } else if (!done) {
    process.stdout.write(`${text}`);
  } else if (process.stdout.clearLine && process.stdout.cursorTo) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${text} ${' '.repeat(padDigits)}(${done}/${total} trials)`);
  }
}
