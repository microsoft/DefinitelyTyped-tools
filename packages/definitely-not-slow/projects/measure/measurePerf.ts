import * as os from 'os';
import * as path from 'path';
import { FS } from 'types-publisher/bin/get-definitely-typed';
import { getTypingInfo } from 'types-publisher/bin/lib/definition-parser';
import { AllPackages } from 'types-publisher/bin/lib/packages';
import { Semver } from 'types-publisher/bin/lib/versions';
import { LanguageServiceHost, CompilerOptions, Node, SourceFile, LanguageService, FormatDiagnosticsHost, ParsedCommandLine, Extension, Identifier } from 'typescript';
import { performance, PerformanceObserver } from 'perf_hooks';
import { LanguageServiceMeasurement, PackageBenchmark, ensureExists } from '../common';
import { stdDev, mean } from './utils';
import { installDependencies } from './installDependencies';
const basePath = path.resolve(__dirname, '../../..');

export interface MeasurePerfOptions {
  packageName: string;
  packageVersion?: string;
  typeScriptVersion: string;
  definitelyTypedRootPath: string;
  definitelyTypedFS: FS;
  maxLanguageServiceTestPositions?: number;
  iterations?: number;
  allPackages: AllPackages;
  ts: typeof import('typescript');
}

export async function measurePerf({
  packageName,
  packageVersion,
  typeScriptVersion,
  definitelyTypedRootPath,
  definitelyTypedFS,
  allPackages,
  maxLanguageServiceTestPositions = 250,
  iterations = 10,
  ts,
}: MeasurePerfOptions) {
  const typesPath = path.join(definitelyTypedRootPath, 'types');
  const packageFS = definitelyTypedFS.subDir(`types/${packageName}`);
  const typingsInfo = await getTypingInfo(packageName, packageFS);
  const benchmarks: PackageBenchmark[] = [];
  let languageService: LanguageService;
  const formatDiagnosticsHost: FormatDiagnosticsHost = {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  };

  for (const version in typingsInfo) {
    if (packageVersion && version !== packageVersion) {
      continue;
    }
    const typings = allPackages.getTypingsData({ name: packageName, majorVersion: parseInt(version, 10) || '*'  });
    const packagePath = path.join(typesPath, typings.subDirectoryPath);
    const typesVersion = getLatestTypesVersionForTypeScriptVersion(typings.typesVersions, typeScriptVersion);
    const latestTSTypesDir = path.resolve(packagePath, typesVersion ? `ts${typesVersion}` : '.');
    await installDependencies(allPackages, typings.id, typesPath);
    
    const commandLine = getCompilerOptionsForPackage(latestTSTypesDir);
    const testPaths = getTestFileNames(commandLine.fileNames);

    const program = ts.createProgram({ rootNames: commandLine.fileNames, options: commandLine.options });
    const diagnostics = program.getSemanticDiagnostics();
    if (diagnostics.length) {
      console.log(ts.formatDiagnostics(diagnostics, formatDiagnosticsHost));
      throw new Error('Compilation had errors');
    }

    const host = createLanguageServiceHostForTestFiles(commandLine.options, commandLine.fileNames);
    languageService = ts.createLanguageService(host);
    const measurements = testPaths.reduce(({ completions, quickInfo }, testPath) => {
      const sourceFile = ts.createSourceFile(
        testPath,
        ts.sys.readFile(testPath)!,
        commandLine.options.target || ts.ScriptTarget.Latest);
      console.log(` - ${path.relative(definitelyTypedRootPath, testPath)}`);
      return {
        completions: completions.concat(measureAtEachIdentifier(sourceFile, iterations, 'completions', getCompletionsAtPosition)),
        quickInfo: quickInfo.concat(measureAtEachIdentifier(sourceFile, iterations, 'quick info', getQuickInfoAtPosition)),
      };
    }, {
      completions: [] as LanguageServiceMeasurement[],
      quickInfo: [] as LanguageServiceMeasurement[],
    });

    const measurement: PackageBenchmark = {
      packageName,
      packageVersion: version,
      typeScriptVersion,
      typeCount: (program as any).getTypeCount(),
      relationCacheSizes: (program as any).getRelationCacheSizes(),
      completions: measurements.completions,
      quickInfo: measurements.quickInfo,
    };

    benchmarks.push(measurement);
  }
  return benchmarks;

  function createLanguageServiceHostForTestFiles(
    compilerOptions: CompilerOptions,
    testPaths: string[],
  ): LanguageServiceHost {
    let version = 0;
    return {
      directoryExists: ts.sys.directoryExists,
      getCompilationSettings: () => compilerOptions,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getDefaultLibFileName: () => path.resolve(basePath, 'node_modules/typescript/lib/lib.d.ts'),
      getNewLine: () => ts.sys.newLine,
      getScriptFileNames: () => testPaths,
      fileExists: ts.sys.fileExists,
      getDirectories: ts.sys.getDirectories,
      getScriptSnapshot: fileName => ts.ScriptSnapshot.fromString(ts.sys.readFile(ensureExists(fileName))!),
      getScriptVersion: () => (version++).toString(),
    };
  }

  function measureAtEachIdentifier(sourceFile: SourceFile, iterations: number, progressTitle: string, fn: (languageService: LanguageService, fileName: string, pos: number) => boolean | undefined) {
    const identifiers = getIdentifiers(sourceFile);
    const testedIdentifiers = sampleIdentifiers(identifiers, maxLanguageServiceTestPositions);

    // Warm-up
    fn(languageService, sourceFile.fileName, 0);

    const measurements: LanguageServiceMeasurement[] = [];
    testedIdentifiers.forEach((identifier, index) => {
      updateProgress(progressTitle, index, testedIdentifiers.length, identifiers.length);
      const start = identifier.getStart(sourceFile);
      const lineAndCharacter = ts.getLineAndCharacterOfPosition(sourceFile, start);
      const durations: number[] = [];
      const measurement: LanguageServiceMeasurement = {
        fileName: path.relative(basePath, sourceFile.fileName),
        line: lineAndCharacter.line + 1,
        offset: lineAndCharacter.character + 1,
        identifierText: identifier.getText(sourceFile),
        start,
        end: identifier.getEnd(),
        duration: -1,
        iterations,
        standardDeviation: 1,
      };

      const observer = new PerformanceObserver((list, obs) => {
        const measurement = list.getEntriesByName('languageServiceMeasurement')[0];
        durations.push(measurement.duration);
        obs.disconnect();
      });

      for (let i = 0; i < iterations; i++) {
        observer.observe({ entryTypes: ['measure'] });
        fn(languageService, sourceFile.fileName, start);
      }

      measurement.duration = mean(durations);
      measurement.standardDeviation = stdDev(durations);
      measurements.push(measurement);
    });

    return measurements;
  }

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

  function getCompletionsAtPosition(languageService: LanguageService, fileName: string, pos: number): boolean {
    performance.mark('beforeCompletions');
    const completions = languageService.getCompletionsAtPosition(fileName, pos, undefined);
    performance.mark('afterCompletions');
    performance.measure('languageServiceMeasurement', 'beforeCompletions', 'afterCompletions');
    return !!completions && completions.entries.length > 0;
  }

  function getQuickInfoAtPosition(languageService: LanguageService, fileName: string, pos: number): boolean {
    performance.mark('beforeQuickInfo');
    const quickInfo = languageService.getQuickInfoAtPosition(fileName, pos);
    performance.mark('afterQuickInfo');
    performance.measure('languageServiceMeasurement', 'beforeQuickInfo', 'afterQuickInfo');
    return !!quickInfo;
  }

  function getCompilerOptionsForPackage(packagePath: string): ParsedCommandLine {
    const tsConfigPath = ensureExists(path.resolve(packagePath, 'tsconfig.json'));
    const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(tsConfigPath, {}, {
      fileExists: ts.sys.fileExists,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      readDirectory: ts.sys.readDirectory,
      readFile: ts.sys.readFile,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      onUnRecoverableConfigFileDiagnostic: diagnostic => {
        console.error(ts.formatDiagnostic(diagnostic, formatDiagnosticsHost));
      },
    });

    if (!parsedCommandLine) {
      throw new Error(`Could not get ParsedCommandLine from config file: ${tsConfigPath}`);
    }

    return parsedCommandLine;
  }

  function getTestFileNames(fileNames: readonly string[]) {
    return fileNames.filter(name => {
      const ext = path.extname(name);
      return (ext === Extension.Ts || ext === Extension.Tsx)  && !name.endsWith(Extension.Dts);
    });
  }
}


function updateProgress(title: string, done: number, sampleTotal: number, total: number) {
  const padDigits = sampleTotal.toString().length - done.toString().length;
  const sampleText = sampleTotal !== total ? ` - sampled from ${total}` : '';
  if (done === sampleTotal - 1) {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`   - ${title} (✔)`);
    }
    process.stdout.write(os.EOL);
  } else if (!done) {
    process.stdout.write(`   - ${title}`);
  } else if (process.stdout.clearLine && process.stdout.cursorTo) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`   - ${title} ${' '.repeat(padDigits)}(${done}/${sampleTotal} positions${sampleText})`);
  }
}

function sampleIdentifiers<T>(identifiers: T[], maxLanguageServiceTestPositions: number): T[] {
  if (identifiers.length <= maxLanguageServiceTestPositions) {
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
  const tsVersion = Semver.parse(typeScriptVersion);
  for (let i = typesVersions.length - 1; i > 0; i--) {
    const typesVersion = Semver.parse(typesVersions[i]);
    if (tsVersion.greaterThan(typesVersion)) {
      return typesVersions[i];
    }
  }
}
