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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const packages_1 = require("types-publisher/bin/lib/packages");
const get_definitely_typed_1 = require("types-publisher/bin/get-definitely-typed");
const logging_1 = require("types-publisher/bin/util/logging");
const common_1 = require("../common");
const common_2 = require("types-publisher/bin/lib/common");
const parse_definitions_1 = __importDefault(require("types-publisher/bin/parse-definitions"));
function getParsedPackages(definitelyTypedPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const definitelyTypedFS = get_definitely_typed_1.getLocallyInstalledDefinitelyTyped(definitelyTypedPath);
        const isDebugging = process.execArgv.some(arg => arg.startsWith('--inspect'));
        if (process.env.NODE_ENV === 'production' || !(yield common_1.pathExists(common_2.dataFilePath(packages_1.typesDataFilename)))) {
            yield parse_definitions_1.default(definitelyTypedFS, isDebugging ? undefined : {
                definitelyTypedPath,
                nProcesses: os.cpus().length,
            }, logging_1.consoleLogger);
        }
        const allPackages = yield packages_1.AllPackages.read(definitelyTypedFS);
        return { definitelyTypedFS, allPackages };
    });
}
exports.getParsedPackages = getParsedPackages;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UGFyc2VkUGFja2FnZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29tbW9uL2dldFBhcnNlZFBhY2thZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLCtEQUFrRjtBQUNsRixtRkFBa0c7QUFDbEcsOERBQWlFO0FBQ2pFLHNDQUF1QztBQUN2QywyREFBOEQ7QUFDOUQsOEZBQXFFO0FBRXJFLFNBQXNCLGlCQUFpQixDQUFDLG1CQUEyQjs7UUFJakUsTUFBTSxpQkFBaUIsR0FBRyx5REFBa0MsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2xGLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzlFLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssWUFBWSxJQUFJLENBQUMsQ0FBQyxNQUFNLG1CQUFVLENBQUMscUJBQVksQ0FBQyw0QkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNqRyxNQUFNLDJCQUFnQixDQUFDLGlCQUFpQixFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDbEUsbUJBQW1CO2dCQUNuQixVQUFVLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU07YUFDN0IsRUFBRSx1QkFBYSxDQUFDLENBQUM7U0FDbkI7UUFDRCxNQUFNLFdBQVcsR0FBRyxNQUFNLHNCQUFXLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDOUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQzVDLENBQUM7Q0FBQTtBQWRELDhDQWNDIn0=