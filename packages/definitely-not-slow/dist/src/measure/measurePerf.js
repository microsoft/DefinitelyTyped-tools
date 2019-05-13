"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const perf_hooks_1 = require("perf_hooks");
const definition_parser_1 = require("types-publisher/bin/lib/definition-parser");
const versions_1 = require("types-publisher/bin/lib/versions");
const typescript_1 = require("typescript");
const installDependencies_1 = require("./installDependencies");
const getParsedCommandLineForPackage_1 = require("./getParsedCommandLineForPackage");
const formatDiagnosticsHost_1 = require("./formatDiagnosticsHost");
const util_1 = require("types-publisher/bin/util/util");
const measureLanguageServiceWorker_1 = require("./measureLanguageServiceWorker");
function measurePerf({ packageName, packageVersion, typeScriptVersion, definitelyTypedRootPath, definitelyTypedFS, allPackages, maxLanguageServiceTestPositions, progress, nProcesses, iterations, tsPath, ts, batchRunStart, }) {
    return __awaiter(this, void 0, void 0, function* () {
        let duration = NaN;
        const sourceVersion = child_process_1.execSync('git rev-parse HEAD', { cwd: definitelyTypedRootPath, encoding: 'utf8' });
        const observer = new perf_hooks_1.PerformanceObserver(list => {
            const totalMeasurement = list.getEntriesByName('benchmark')[0];
            duration = totalMeasurement.duration;
        });
        observer.observe({ entryTypes: ['measure'] });
        perf_hooks_1.performance.mark('benchmarkStart');
        const typesPath = path.join(definitelyTypedRootPath, 'types');
        const packageFS = definitelyTypedFS.subDir(`types/${packageName}`);
        const typingsInfo = yield definition_parser_1.getTypingInfo(packageName, packageFS);
        const benchmarks = [];
        for (const version in typingsInfo) {
            if (packageVersion && version !== packageVersion) {
                continue;
            }
            const typings = allPackages.getTypingsData({ name: packageName, majorVersion: parseInt(version, 10) || '*' });
            const packagePath = path.join(typesPath, typings.subDirectoryPath);
            const typesVersion = getLatestTypesVersionForTypeScriptVersion(typings.typesVersions, typeScriptVersion);
            const latestTSTypesDir = path.resolve(packagePath, typesVersion ? `ts${typesVersion}` : '.');
            yield installDependencies_1.installDependencies(allPackages, typings.id, typesPath);
            const commandLine = getParsedCommandLineForPackage_1.getParsedCommandLineForPackage(ts, latestTSTypesDir);
            const testPaths = getTestFileNames(commandLine.fileNames);
            let done = 0;
            const testMatrix = createLanguageServiceTestMatrix(testPaths, latestTSTypesDir, commandLine.options, iterations);
            if (progress) {
                updateProgress(`v${version}: benchmarking over ${nProcesses} processes`, 0, testMatrix.inputs.length);
            }
            yield util_1.runWithChildProcesses({
                inputs: testMatrix.inputs,
                commandLineArgs: [],
                workerFile: measureLanguageServiceWorker_1.measureLanguageServiceWorkerFilename,
                nProcesses,
                handleOutput: (measurement) => {
                    testMatrix.addMeasurement(measurement);
                    if (progress) {
                        updateProgress(`v${version}: benchmarking over ${nProcesses} processes`, ++done, testMatrix.inputs.length);
                    }
                },
            });
            const program = ts.createProgram({ rootNames: commandLine.fileNames, options: commandLine.options });
            const diagnostics = program.getSemanticDiagnostics().filter(diagnostic => {
                return diagnostic.code === 2307; // Cannot find module
            });
            if (diagnostics.length) {
                console.log(ts.formatDiagnostics(diagnostics, formatDiagnosticsHost_1.formatDiagnosticsHost));
                throw new Error('Compilation had errors');
            }
            const measurement = {
                benchmarkDuration: duration,
                sourceVersion,
                packageName,
                packageVersion: version,
                typeScriptVersion,
                typeScriptVersionMajorMinor: ts.versionMajorMinor,
                typeCount: program.getTypeCount(),
                relationCacheSizes: program.getRelationCacheSizes && program.getRelationCacheSizes(),
                languageServiceBenchmarks: testMatrix.getAllBenchmarks(),
                batchRunStart,
            };
            benchmarks.push(measurement);
        }
        perf_hooks_1.performance.mark('benchmarkEnd');
        perf_hooks_1.performance.measure('benchmark', 'benchmarkStart', 'benchmarkEnd');
        benchmarks.forEach(benchmark => benchmark.benchmarkDuration = duration);
        if (!benchmarks.length) {
            throw new Error(`No v${packageVersion} found for package ${packageName}.`);
        }
        return benchmarks;
        function getIdentifiers(sourceFile) {
            const identifiers = [];
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
        function getTestFileNames(fileNames) {
            return fileNames.filter(name => {
                const ext = path.extname(name);
                return (ext === typescript_1.Extension.Ts || ext === typescript_1.Extension.Tsx) && !name.endsWith(typescript_1.Extension.Dts);
            });
        }
        function createLanguageServiceTestMatrix(testPaths, packageDirectory, compilerOptions, iterations) {
            const fileMap = new Map();
            const inputs = [];
            for (const testPath of testPaths) {
                const positionMap = new Map();
                fileMap.set(testPath, positionMap);
                const sourceFile = ts.createSourceFile(testPath, ts.sys.readFile(testPath), compilerOptions.target || ts.ScriptTarget.Latest);
                const identifiers = sampleIdentifiers(getIdentifiers(sourceFile), maxLanguageServiceTestPositions);
                // Do the loops in this order so that a single child process doesn’t
                // run iterations of the same exact measurement back-to-back to avoid
                // v8 optimizing a significant chunk of the work away.
                for (let i = 0; i < iterations; i++) {
                    for (const identifier of identifiers) {
                        const start = identifier.getStart(sourceFile);
                        if (i === 0) {
                            const lineAndCharacter = ts.getLineAndCharacterOfPosition(sourceFile, start);
                            const benchmark = {
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
                addMeasurement: (measurement) => {
                    const benchmark = fileMap.get(measurement.fileName).get(measurement.start);
                    benchmark.completionsDurations.push(measurement.completionsDuration);
                    benchmark.quickInfoDurations.push(measurement.quickInfoDuration);
                },
                getAllBenchmarks: () => {
                    return Array.prototype.concat.apply([], Array.from(fileMap.values()).map(map => Array.from(map.values())));
                },
            };
        }
    });
}
exports.measurePerf = measurePerf;
function sampleIdentifiers(identifiers, maxLanguageServiceTestPositions) {
    if (!maxLanguageServiceTestPositions || identifiers.length <= maxLanguageServiceTestPositions) {
        return identifiers;
    }
    // 5% at beginning, 20% at end, 75% evenly distributed through middle
    const beginningIdentifiersCount = Math.round(.05 * maxLanguageServiceTestPositions);
    const endIdentifiersCount = Math.round(0.2 * maxLanguageServiceTestPositions);
    const middleIdentifiersCount = Math.round(maxLanguageServiceTestPositions
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
function getLatestTypesVersionForTypeScriptVersion(typesVersions, typeScriptVersion) {
    const tsVersion = versions_1.Semver.parse(typeScriptVersion.replace(/-dev.*$/, ''));
    for (let i = typesVersions.length - 1; i > 0; i--) {
        const typesVersion = versions_1.Semver.parse(typesVersions[i]);
        if (tsVersion.greaterThan(typesVersion)) {
            return typesVersions[i];
        }
    }
}
function updateProgress(text, done, total) {
    const padDigits = total.toString().length - done.toString().length;
    if (done === total) {
        if (process.stdout.clearLine && process.stdout.cursorTo) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`${text} (✔)`);
            process.stdout.write(os.EOL);
        }
    }
    else if (!done) {
        process.stdout.write(`${text}`);
    }
    else if (process.stdout.clearLine && process.stdout.cursorTo) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${text} ${' '.repeat(padDigits)}(${done}/${total} trials)`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVhc3VyZVBlcmYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbWVhc3VyZS9tZWFzdXJlUGVyZi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsaURBQXlDO0FBQ3pDLDJDQUE4RDtBQUU5RCxpRkFBMEU7QUFFMUUsK0RBQTBEO0FBQzFELDJDQUEwRTtBQUUxRSwrREFBNEQ7QUFDNUQscUZBQWtGO0FBQ2xGLG1FQUFnRTtBQUNoRSx3REFBc0U7QUFDdEUsaUZBQThIO0FBa0I5SCxTQUFzQixXQUFXLENBQUMsRUFDaEMsV0FBVyxFQUNYLGNBQWMsRUFDZCxpQkFBaUIsRUFDakIsdUJBQXVCLEVBQ3ZCLGlCQUFpQixFQUNqQixXQUFXLEVBQ1gsK0JBQStCLEVBQy9CLFFBQVEsRUFDUixVQUFVLEVBQ1YsVUFBVSxFQUNWLE1BQU0sRUFDTixFQUFFLEVBQ0YsYUFBYSxHQUNNOztRQUNuQixJQUFJLFFBQVEsR0FBRyxHQUFHLENBQUM7UUFDbkIsTUFBTSxhQUFhLEdBQUcsd0JBQVEsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLEdBQUcsRUFBRSx1QkFBdUIsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN6RyxNQUFNLFFBQVEsR0FBRyxJQUFJLGdDQUFtQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzlDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQy9ELFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzlDLHdCQUFXLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENB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