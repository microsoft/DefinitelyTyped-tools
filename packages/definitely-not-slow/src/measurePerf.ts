import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { LanguageServiceHost, CompilerOptions, Node } from 'typescript';
import { performance, PerformanceObserver } from 'perf_hooks';
import { CompletionMeasurement, PackageMeasurement } from './types';
import { stdDev, mean } from './utils';
const basePath = path.resolve(__dirname, '..');

export interface MeasurePerfOptions {
    packageName: string;
    definitelyTypedRootPath: string;
    iterations: number;
    ts: typeof import('typescript');
}

export function measurePerf({
    definitelyTypedRootPath,
    ts,
    iterations,
    packageName,
}: MeasurePerfOptions) {
    const packagePath = ensureExists(path.resolve(definitelyTypedRootPath, 'types', packageName));
    const testPaths = getTestFileNames(packagePath);
    const compilerOptions = getCompilerOptionsForPackage(packagePath);
    const host = createLanguageServiceHostForTestFiles(compilerOptions, testPaths);
    const completions = testPaths.reduce((all: CompletionMeasurement[], testPath) => {
        return all.concat(getCompletionsAtEachIdentifier(testPath, iterations))
    }, []);

    const program = ts.createProgram({ rootNames: testPaths, options: compilerOptions });
    program.getSemanticDiagnostics();

    const measurement: PackageMeasurement = {
        typeCount: (program as any).getTypeCount(),
        relationCacheSizes: (program as any).getRelationCacheSizes(),
        completions,
    };

    return measurement;

    function createLanguageServiceHostForTestFiles(
        compilerOptions: CompilerOptions,
        testPaths: string[],
    ): LanguageServiceHost {
        return {
            directoryExists: ts.sys.directoryExists,
            getCompilationSettings: () => compilerOptions,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getDefaultLibFileName: () => path.resolve(__dirname, '../node_modules/typescript/lib/lib.d.ts'),
            getNewLine: () => ts.sys.newLine,
            getScriptFileNames: () => testPaths,
            fileExists: ts.sys.fileExists,
            getDirectories: ts.sys.getDirectories,
            getScriptSnapshot: fileName => ts.ScriptSnapshot.fromString(ts.sys.readFile(ensureExists(fileName))!),
            getScriptVersion: () => '0',
        };
    }

    function getCompletionsAtEachIdentifier(fileName: string, iterations: number) {
        const sourceFile = ts.createSourceFile(fileName, ts.sys.readFile(fileName)!, compilerOptions.target || ts.ScriptTarget.Latest);
        const identifiers: Node[] = [];
        ts.forEachChild(sourceFile, function visit(node) {
            if (ts.isIdentifier(node)) {
                identifiers.push(node);
            } else {
                ts.forEachChild(node, visit);
            }
        });

        // Warm-up
        getCompletionsAtPosition(fileName, 0, host);

        const measurements: CompletionMeasurement[] = [];
        identifiers.forEach((identifier, index) => {
            updateFileProgress(path.relative(definitelyTypedRootPath, fileName), index, identifiers.length);
            const start = identifier.getStart(sourceFile);
            const lineAndCharacter = ts.getLineAndCharacterOfPosition(sourceFile, start);
            const durations: number[] = [];
            const completionMeasurement: CompletionMeasurement = {
                fileName: path.relative(basePath, sourceFile.fileName),
                line: lineAndCharacter.line + 1,
                offset: lineAndCharacter.character + 1,
                identifierText: identifier.getText(sourceFile),
                completionsCount: 0,
                start,
                end: identifier.getEnd(),
                duration: -1,
                iterations,
                standardDeviation: 1,
            };

            const observer = new PerformanceObserver((list, obs) => {
                const measurement = list.getEntriesByName('completions')[0];
                durations.push(measurement.duration);
                obs.disconnect();
            });

            for (let i = 0; i < iterations; i++) {
                observer.observe({ entryTypes: ['measure'] });
                completionMeasurement.completionsCount = getCompletionsAtPosition(
                    fileName,
                    identifier.getStart(sourceFile),
                    host);
            }

            completionMeasurement.duration = mean(durations);
            completionMeasurement.standardDeviation = stdDev(durations);
            measurements.push(completionMeasurement);
        });

        return measurements;
    }

    function getCompletionsAtPosition(fileName: string, pos: number, host: LanguageServiceHost): number {
        const languageService = ts.createLanguageService(host);
        performance.mark('beforeCompletions');
        const completions = languageService.getCompletionsAtPosition(fileName, pos, undefined);
        performance.mark('afterCompletions');
        performance.measure('completions', 'beforeCompletions', 'afterCompletions');
        return completions ? completions.entries.length : 0;
    }

    function getTestFileNames(packagePath: string): string[] {
        const files = ts.sys.readDirectory(packagePath, [ts.Extension.Ts, ts.Extension.Tsx]);
        return files.filter(file => !file.endsWith(ts.Extension.Dts));
    }

    function getCompilerOptionsForPackage(packagePath: string): CompilerOptions {
        const tsConfigPath = ensureExists(path.resolve(packagePath, 'tsconfig.json'));
        const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(tsConfigPath, {}, {
            fileExists: ts.sys.fileExists,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            readDirectory: ts.sys.readDirectory,
            readFile: ts.sys.readFile,
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            onUnRecoverableConfigFileDiagnostic: diagnostic => {
                console.error(ts.formatDiagnostic(diagnostic, {
                    getCanonicalFileName: fileName => fileName,
                    getCurrentDirectory: ts.sys.getCurrentDirectory,
                    getNewLine: () => ts.sys.newLine,
                }));
            },
        });

        return parsedCommandLine ? parsedCommandLine.options : ts.getDefaultCompilerOptions();
    }
}

function updateFileProgress(fileName: string, done: number, total: number) {
    const padDigits = total.toString().length - done.toString().length;
    if (done === total - 1) {
        if (process.stdout.clearLine && process.stdout.cursorTo) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(` - ${fileName}`);
        }
        process.stdout.write(os.EOL);
    } else if (!done) {
        process.stdout.write(` - ${fileName}`);
    } else if (process.stdout.clearLine && process.stdout.cursorTo) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(` - ${fileName} ${' '.repeat(padDigits)}(${done}/${total} positions)`);
    }
}

function ensureExists(...pathNames: string[]): string {
    for (const pathName of pathNames) {
        if (fs.existsSync(pathName)) {
            return pathName;
        }
    }
    const pathNamesPrint = pathNames.length > 1 ? '\n' + pathNames.map(s => ` - ${s}`).join('\n') : `'${pathNames[0]}`;
    throw new Error(`File or directory does not exist: ${pathNamesPrint}`);
}
