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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const common_1 = require("../common");
const util_2 = require("types-publisher/bin/util/util");
const test_runner_1 = require("types-publisher/bin/tester/test-runner");
const get_affected_packages_1 = require("types-publisher/bin/tester/get-affected-packages");
const writeFile = util_1.promisify(fs.writeFile);
function convertArgs(args) {
    const tsVersion = args.typeScriptVersion.toString();
    if (tsVersion.split('.').length !== 2) {
        throw new Error(`Argument 'typeScriptVersion' must be in format 'major.minor' (e.g. '3.1')`);
    }
    const dtPath = common_1.assertString(args.definitelyTypedPath || process.cwd());
    const definitelyTypedPath = path.isAbsolute(dtPath) ? dtPath : path.resolve(process.cwd(), dtPath);
    return {
        definitelyTypedPath,
        agentCount: common_1.assertNumber(args.agentCount),
        typeScriptVersionMajorMinor: tsVersion,
        outFile: common_1.assertString(args.outFile),
    };
}
function getPackagesToBenchmark(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const { definitelyTypedPath, agentCount, typeScriptVersionMajorMinor, outFile, } = convertArgs(args);
        const { allPackages } = yield common_1.getParsedPackages(definitelyTypedPath);
        const { container } = yield common_1.getDatabase("read" /* Read */);
        const changedPackages = yield util_2.nAtATime(10, allPackages.allTypings(), (typingsData) => __awaiter(this, void 0, void 0, function* () {
            const response = yield container.items.query({
                query: `SELECT TOP 1 * FROM ${common_1.config.database.packageBenchmarksContainerId} b` +
                    `  WHERE b.body.packageName = @packageName` +
                    `  AND b.body.packageVersion = @packageVersion` +
                    `  AND b.body.typeScriptVersionMajorMinor = @tsVersion` +
                    `  ORDER BY b.createdAt DESC`,
                parameters: [
                    { name: '@packageName', value: typingsData.id.name },
                    { name: '@packageVersion', value: typingsData.id.majorVersion.toString() },
                    { name: '@tsVersion', value: typeScriptVersionMajorMinor },
                ],
            }, { enableCrossPartitionQuery: true }).current();
            // No previous run exists; run one
            if (!response.result) {
                return typingsData.id;
            }
            const result = response.result;
            const diff = yield util_2.execAndThrowErrors(`git diff --name-status ${result.body.sourceVersion}`, definitelyTypedPath);
            if (!diff) {
                return undefined;
            }
            const changes = diff.split('\n').map(line => {
                const [status, file] = line.split(/\s+/, 2);
                return { status: status.trim(), file: file.trim() };
            });
            const changedPackages = yield test_runner_1.gitChanges(changes);
            if (changedPackages.some(changedPackage => changedPackage.name === typingsData.id.name && changedPackage.majorVersion === typingsData.id.majorVersion)) {
                // Package has changed; run it
                return typingsData.id;
            }
        }));
        const affectedPackages = get_affected_packages_1.getAffectedPackages(allPackages, common_1.compact(changedPackages));
        const packagesToBenchmark = [...affectedPackages.changedPackages, ...affectedPackages.dependentPackages];
        const groups = packagesToBenchmark.reduce((groups, typingsData, index) => {
            const agentIndex = index % agentCount;
            if (groups[agentIndex]) {
                groups[agentIndex].push(typingsData.id);
            }
            else {
                groups[agentIndex] = [typingsData.id];
            }
            return groups;
        }, []);
        const benchmarkOptions = {
            definitelyTypedPath,
            tsVersion: typeScriptVersionMajorMinor,
            upload: true,
        };
        yield writeFile(outFile, JSON.stringify({
            changedPackageCount: affectedPackages.changedPackages.length,
            dependentPackageCount: affectedPackages.dependentPackages.length,
            totalPackageCount: packagesToBenchmark.length,
            options: benchmarkOptions,
            groups,
        }, undefined, 2), 'utf8');
    });
}
exports.getPackagesToBenchmark = getPackagesToBenchmark;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UGFja2FnZXNUb0JlbmNobWFyay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGkvZ2V0UGFja2FnZXNUb0JlbmNobWFyay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsK0JBQWlDO0FBQ2pDLHNDQUFzSztBQUN0Syx3REFBNkU7QUFDN0Usd0VBQW9FO0FBQ3BFLDRGQUF1RjtBQUd2RixNQUFNLFNBQVMsR0FBRyxnQkFBUyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQVMxQyxTQUFTLFdBQVcsQ0FBQyxJQUFVO0lBQzdCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNwRCxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNyQyxNQUFNLElBQUksS0FBSyxDQUFDLDJFQUEyRSxDQUFDLENBQUM7S0FDOUY7SUFDRCxNQUFNLE1BQU0sR0FBRyxxQkFBWSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN2RSxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbkcsT0FBTztRQUNMLG1CQUFtQjtRQUNuQixVQUFVLEVBQUUscUJBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3pDLDJCQUEyQixFQUFFLFNBQVM7UUFDdEMsT0FBTyxFQUFFLHFCQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztLQUNwQyxDQUFDO0FBQ0osQ0FBQztB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