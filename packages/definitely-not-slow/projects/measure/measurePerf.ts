import * as os from 'os';
import * as path from 'path';
import { FS } from 'types-publisher/bin/get-definitely-typed';
import { getTypingInfo } from 'types-publisher/bin/lib/definition-parser';
import { AllPackages } from 'types-publisher/bin/lib/packages';
import { Semver } from 'types-publisher/bin/lib/versions';
import { Node, SourceFile, Extension, CompilerOptions } from 'typescript';
import { LanguageServiceMeasurement, PackageBenchmark, LanguageServiceMeasurementTarget } from '../common';
import { installDependencies } from './installDependencies';
import { getParsedCommandLineForPackage } from './getParsedCommandLineForPackage';
import { formatDiagnosticsHost } from './formatDiagnosticsHost';
import { runWithChildProcesses } from 'types-publisher/bin/util/util';
import { measureLanguageServiceWorkerFilename, MeasureLanguageServiceChildProcessArgs } from './measureLanguageServiceWorker';

export interface MeasurePerfOptions {
  packageName: string;
  packageVersion?: string;
  typeScriptVersion: string;
  definitelyTypedRootPath: string;
  definitelyTypedFS: FS;
  maxLanguageServiceTestPositions?: number;
  nProcesses?: number;
  iterations?: number;
  measure?: LanguageServiceMeasurementTarget;
  allPackages: AllPackages;
  tsPath: string;
  ts: typeof import('typescript');
}

export async function measurePerf({
  packageName,
  packageVersion,
  typeScriptVersion,
  definitelyTypedRootPath,
  definitelyTypedFS,
  allPackages,
  maxLanguageServiceTestPositions,
  nProcesses = os.cpus().length - 1,
  iterations = 10,
  measure = LanguageServiceMeasurementTarget.All,
  tsPath,
  ts,
}: MeasurePerfOptions) {
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
    const completions: LanguageServiceMeasurement[] = [];
    const quickInfo: LanguageServiceMeasurement[] = [];
    const inputs = getLanguageServiceTestMatrix(testPaths, latestTSTypesDir, measure, commandLine.options, iterations);
    updateProgress(`Testing language service over ${nProcesses} processes`, 0, inputs.length);
    await runWithChildProcesses({
      inputs,
      commandLineArgs: [],
      workerFile: measureLanguageServiceWorkerFilename,
      nProcesses,
      handleOutput: (positionMeasurements: LanguageServiceMeasurement[]) => {
        for (const measurement of positionMeasurements) {
          switch (measurement.kind) {
            case LanguageServiceMeasurementTarget.Completions:
              completions.push(measurement);
              break;
            case LanguageServiceMeasurementTarget.QuickInfo:
              quickInfo.push(measurement);
              break;
            default:
              throw new Error(`Measurement kind must be exactly one LanguageServiceMeasurementTarget`);
          }
        }
        updateProgress(
          `Testing language service over ${nProcesses} processes`,
          ++done,
          inputs.length);
      },
    });

    const program = ts.createProgram({ rootNames: commandLine.fileNames, options: commandLine.options });
    const diagnostics = program.getSemanticDiagnostics();
    if (diagnostics.length) {
      console.log(ts.formatDiagnostics(diagnostics, formatDiagnosticsHost));
      throw new Error('Compilation had errors');
    }

    const measurement: PackageBenchmark = {
      packageName,
      packageVersion: version,
      typeScriptVersion,
      typeCount: (program as any).getTypeCount(),
      relationCacheSizes: (program as any).getRelationCacheSizes(),
      completions,
      quickInfo,
    };

    benchmarks.push(measurement);
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

  function getLanguageServiceTestMatrix(
    testPaths: string[],
    packageDirectory: string,
    measure: LanguageServiceMeasurementTarget,
    compilerOptions: CompilerOptions,
    iterations: number
  ): MeasureLanguageServiceChildProcessArgs[] {
    const args: MeasureLanguageServiceChildProcessArgs[] = [];
    for (const testPath of testPaths) {
      const sourceFile = ts.createSourceFile(
        testPath,
        ts.sys.readFile(testPath)!,
        compilerOptions.target || ts.ScriptTarget.Latest);
      const identifiers = sampleIdentifiers(getIdentifiers(sourceFile), maxLanguageServiceTestPositions);
      for (const identifier of identifiers) {
        const start = identifier.getStart(sourceFile);
        const lineAndCharacter = ts.getLineAndCharacterOfPosition(sourceFile, start);
        args.push({
          kind: measure,
          fileName: testPath,
          start,
          end: identifier.getEnd(),
          identifierText: identifier.getText(sourceFile),
          line: lineAndCharacter.line + 1,
          offset: lineAndCharacter.character + 1,
          packageDirectory,
          iterations,
          tsPath,
        });
      }
    }
    return args;
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
    process.stdout.write(`${text} ${' '.repeat(padDigits)}(${done}/${total} positions)`);
  }
}
