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
const get_affected_packages_1 = require("types-publisher/bin/tester/get-affected-packages");
const util_1 = require("types-publisher/bin/util/util");
const common_1 = require("../common");
function installDependencies(allPackages, packageId, typesPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const { changedPackages, dependentPackages } = get_affected_packages_1.getAffectedPackages(allPackages, [packageId]);
        const dependencies = get_affected_packages_1.allDependencies(allPackages, [...changedPackages, ...dependentPackages]);
        yield util_1.nAtATime(Math.min(os.cpus().length - 1, 6), dependencies, (typingsData) => __awaiter(this, void 0, void 0, function* () {
            const packagePath = path.join(typesPath, typingsData.name);
            if (!(yield common_1.pathExists(path.join(packagePath, 'package.json')))) {
                return;
            }
            const cmd = 'npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links';
            return common_1.run(packagePath, cmd);
        }));
    });
}
exports.installDependencies = installDependencies;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFsbERlcGVuZGVuY2llcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9tZWFzdXJlL2luc3RhbGxEZXBlbmRlbmNpZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLDRGQUF3RztBQUV4Ryx3REFBeUQ7QUFDekQsc0NBQTRDO0FBRTVDLFNBQXNCLG1CQUFtQixDQUFDLFdBQXdCLEVBQUUsU0FBb0IsRUFBRSxTQUFpQjs7UUFDekcsTUFBTSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxHQUFHLDJDQUFtQixDQUFDLFdBQVcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDN0YsTUFBTSxZQUFZLEdBQUcsdUNBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxHQUFHLGVBQWUsRUFBRSxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQztRQUM5RixNQUFNLGVBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFlBQVksRUFBRSxDQUFNLFdBQVcsRUFBQyxFQUFFO1lBQ2hGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMzRCxJQUFJLENBQUMsQ0FBQSxNQUFNLG1CQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQSxFQUFFO2dCQUMzRCxPQUFPO2FBQ1Y7WUFFRCxNQUFNLEdBQUcsR0FBRywrRUFBK0UsQ0FBQztZQUM1RixPQUFPLFlBQUcsQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDakMsQ0FBQyxDQUFBLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FBQTtBQVpELGtEQVlDIn0=