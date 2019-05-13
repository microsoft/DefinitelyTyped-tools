"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
function summarize(benchmark) {
    return Object.assign({ packageName: benchmark.packageName, packageVersion: benchmark.packageVersion, typeScriptVersion: benchmark.typeScriptVersion, typeScriptVersionMajorMinor: benchmark.typeScriptVersionMajorMinor, sourceVersion: benchmark.sourceVersion, typeCount: benchmark.typeCount, relationCacheSizes: benchmark.relationCacheSizes, benchmarkDuration: benchmark.benchmarkDuration, batchRunStart: benchmark.batchRunStart }, summarizeStats(benchmark.languageServiceBenchmarks));
}
exports.summarize = summarize;
function summarizeStats(benchmarks) {
    return [
        ['completions', (benchmark) => benchmark.completionsDurations],
        ['quickInfo', (benchmark) => benchmark.quickInfoDurations],
    ].reduce((acc, [key, getDurations]) => {
        const durations = Array.prototype.concat.apply([], benchmarks.map(getDurations));
        const worst = utils_1.max(benchmarks, m => utils_1.mean(getDurations(m)));
        return Object.assign({}, acc, { [key]: {
                mean: utils_1.mean(durations),
                median: utils_1.median(durations),
                worst,
            } });
    }, {});
}
exports.summarizeStats = summarizeStats;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VtbWFyaXplLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL21lYXN1cmUvc3VtbWFyaXplLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsbUNBQTRDO0FBRTVDLFNBQWdCLFNBQVMsQ0FBQyxTQUEyQjtJQUNuRCx1QkFDRSxXQUFXLEVBQUUsU0FBUyxDQUFDLFdBQVcsRUFDbEMsY0FBYyxFQUFFLFNBQVMsQ0FBQyxjQUFjLEVBQ3hDLGlCQUFpQixFQUFFLFNBQVMsQ0FBQyxpQkFBaUIsRUFDOUMsMkJBQTJCLEVBQUUsU0FBUyxDQUFDLDJCQUEyQixFQUNsRSxhQUFhLEVBQUUsU0FBUyxDQUFDLGFBQWEsRUFDdEMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxTQUFTLEVBQzlCLGtCQUFrQixFQUFFLFNBQVMsQ0FBQyxrQkFBa0IsRUFDaEQsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLGlCQUFpQixFQUM5QyxhQUFhLEVBQUUsU0FBUyxDQUFDLGFBQWEsSUFDbkMsY0FBYyxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxFQUN2RDtBQUNILENBQUM7QUFiRCw4QkFhQztBQUVELFNBQWdCLGNBQWMsQ0FBQyxVQUFzQztJQUluRSxPQUFPO1FBQ0wsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxTQUFtQyxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQVU7UUFDakcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxTQUFtQyxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQVU7S0FDOUYsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsWUFBWSxDQUFDLEVBQUUsRUFBRTtRQUNwQyxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUNqRixNQUFNLEtBQUssR0FBRyxXQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUQseUJBQ0ssR0FBRyxJQUNOLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ0wsSUFBSSxFQUFFLFlBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3JCLE1BQU0sRUFBRSxjQUFNLENBQUMsU0FBUyxDQUFDO2dCQUN6QixLQUFLO2FBQ04sSUFDRDtJQUNKLENBQUMsRUFBRSxFQUFnRixDQUFDLENBQUM7QUFDdkYsQ0FBQztBQW5CRCx3Q0FtQkMifQ==