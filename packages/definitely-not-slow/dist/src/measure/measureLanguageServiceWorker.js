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
const assert = __importStar(require("assert"));
const perf_hooks_1 = require("perf_hooks");
const getParsedCommandLineForPackage_1 = require("./getParsedCommandLineForPackage");
const createLanguageServiceHost_1 = require("./createLanguageServiceHost");
exports.measureLanguageServiceWorkerFilename = __filename;
function isMeasureLanguageServiceArgs(_) {
    return true; // Whatever
}
if (!module.parent) {
    if (!process.send) {
        throw new Error('Process was not started as a forked process');
    }
    let ts;
    let commandLine;
    let languageServiceHost;
    let languageService;
    process.on('message', (message) => __awaiter(this, void 0, void 0, function* () {
        for (const args of message) {
            if (isMeasureLanguageServiceArgs(args)) {
                if (!ts || !commandLine || !languageServiceHost || !languageService) {
                    ts = (yield Promise.resolve().then(() => __importStar(require(args.tsPath))));
                    commandLine = getParsedCommandLineForPackage_1.getParsedCommandLineForPackage(ts, args.packageDirectory);
                    languageServiceHost = createLanguageServiceHost_1.createLanguageServiceHost(ts, commandLine.options, commandLine.fileNames);
                    languageService = ts.createLanguageService(languageServiceHost);
                    // Warm up - make sure functions are compiled
                    getCompletionsAtPosition(languageService, args.fileName, args.start);
                    getQuickInfoAtPosition(languageService, args.fileName, args.start);
                }
                const positionMeasurement = yield measureLanguageService(languageService, args);
                process.send(positionMeasurement);
            }
            else {
                throw new Error('Invalid command-line arguments');
            }
        }
    }));
    process.on('unhandledRejection', (err) => {
        console.error(err);
        process.exit(1);
    });
}
function measureLanguageService(languageService, args) {
    return __awaiter(this, void 0, void 0, function* () {
        return Object.assign({ fileName: args.fileName, start: args.start }, measureAtPosition(args.fileName, args.start));
        function measureAtPosition(fileName, position) {
            let quickInfoDuration = NaN;
            let completionsDuration = NaN;
            const observer = new perf_hooks_1.PerformanceObserver((list) => {
                const completionsMeasurement = list.getEntriesByName('completionsMeasurement')[0];
                const quickInfoMeasurement = list.getEntriesByName('quickInfoMeasurement')[0];
                if (completionsMeasurement) {
                    completionsDuration = completionsMeasurement.duration;
                }
                if (quickInfoMeasurement) {
                    quickInfoDuration = quickInfoMeasurement.duration;
                }
            });
            observer.observe({ entryTypes: ['measure'] });
            getCompletionsAtPosition(languageService, fileName, position);
            getQuickInfoAtPosition(languageService, fileName, position);
            assert.ok(!isNaN(quickInfoDuration), 'No measurement was recorded for quick info');
            assert.ok(!isNaN(completionsDuration), 'No measurement was recorded for completions');
            observer.disconnect();
            return {
                quickInfoDuration,
                completionsDuration,
            };
        }
    });
}
function getCompletionsAtPosition(languageService, fileName, pos) {
    perf_hooks_1.performance.mark('beforeCompletions');
    const completions = languageService.getCompletionsAtPosition(fileName, pos, undefined);
    perf_hooks_1.performance.mark('afterCompletions');
    perf_hooks_1.performance.measure('completionsMeasurement', 'beforeCompletions', 'afterCompletions');
    return !!completions && completions.entries.length > 0;
}
function getQuickInfoAtPosition(languageService, fileName, pos) {
    perf_hooks_1.performance.mark('beforeQuickInfo');
    const quickInfo = languageService.getQuickInfoAtPosition(fileName, pos);
    perf_hooks_1.performance.mark('afterQuickInfo');
    perf_hooks_1.performance.measure('quickInfoMeasurement', 'beforeQuickInfo', 'afterQuickInfo');
    return !!quickInfo;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVhc3VyZUxhbmd1YWdlU2VydmljZVdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9tZWFzdXJlL21lYXN1cmVMYW5ndWFnZVNlcnZpY2VXb3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFDakMsMkNBQThEO0FBRTlELHFGQUFrRjtBQUNsRiwyRUFBd0U7QUFFM0QsUUFBQSxvQ0FBb0MsR0FBRyxVQUFVLENBQUM7QUFXL0QsU0FBUyw0QkFBNEIsQ0FBQyxDQUFNO0lBQzFDLE9BQU8sSUFBSSxDQUFDLENBQUMsV0FBVztBQUMxQixDQUFDO0FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7SUFDbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7UUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO0tBQ2hFO0lBRUQsSUFBSSxFQUEyQyxDQUFDO0lBQ2hELElBQUksV0FBMEMsQ0FBQztJQUMvQyxJQUFJLG1CQUFvRCxDQUFDO0lBQ3pELElBQUksZUFBNEMsQ0FBQztJQUVqRCxPQUFPLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFPLE9BQWtCLEVBQUUsRUFBRTtRQUNqRCxLQUFLLE1BQU0sSUFBSSxJQUFJLE9BQU8sRUFBRTtZQUMxQixJQUFJLDRCQUE0QixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN0QyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsbUJBQW1CLElBQUksQ0FBQyxlQUFlLEVBQUU7b0JBQ25FLEVBQUUsSUFBRyx3REFBYSxJQUFJLENBQUMsTUFBTSxHQUFnQyxDQUFBLENBQUM7b0JBQzlELFdBQVcsR0FBRywrREFBOEIsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7b0JBQ3hFLG1CQUFtQixHQUFHLHFEQUF5QixDQUFDLEVBQUUs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