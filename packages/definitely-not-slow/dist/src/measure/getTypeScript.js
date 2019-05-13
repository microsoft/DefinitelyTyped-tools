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
const util_1 = require("util");
const installer_1 = require("dtslint/bin/installer");
const exists = util_1.promisify(fs.exists);
function getTypeScript(version, localTypeScriptPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = installer_1.typeScriptPath(version, localTypeScriptPath);
        if (version === 'next') {
            yield installer_1.cleanInstalls();
            yield installer_1.installNext();
        }
        else if (!(yield exists(path))) {
            yield installer_1.installAll();
        }
        if (!(yield exists(path))) {
            throw new Error(`Version ${version} is not available`);
        }
        return {
            ts: yield Promise.resolve().then(() => __importStar(require(path))),
            tsPath: path,
        };
    });
}
exports.getTypeScript = getTypeScript;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0VHlwZVNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9tZWFzdXJlL2dldFR5cGVTY3JpcHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsK0JBQWlDO0FBQ2pDLHFEQUErRjtBQUMvRixNQUFNLE1BQU0sR0FBRyxnQkFBUyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUVwQyxTQUFzQixhQUFhLENBQ2pDLE9BQWUsRUFDZixtQkFBNEI7O1FBRTVCLE1BQU0sSUFBSSxHQUFHLDBCQUFjLENBQUMsT0FBTyxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDMUQsSUFBSSxPQUFPLEtBQUssTUFBTSxFQUFFO1lBQ3RCLE1BQU0seUJBQWEsRUFBRSxDQUFDO1lBQ3RCLE1BQU0sdUJBQVcsRUFBRSxDQUFDO1NBQ3JCO2FBQU0sSUFBSSxDQUFDLENBQUEsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUEsRUFBRTtZQUM5QixNQUFNLHNCQUFVLEVBQUUsQ0FBQztTQUNwQjtRQUNELElBQUksQ0FBQyxDQUFBLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBLEVBQUU7WUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxXQUFXLE9BQU8sbUJBQW1CLENBQUMsQ0FBQztTQUN4RDtRQUNELE9BQU87WUFDTCxFQUFFLEVBQUUsd0RBQWEsSUFBSSxHQUFDO1lBQ3RCLE1BQU0sRUFBRSxJQUFJO1NBQ2IsQ0FBQztJQUNKLENBQUM7Q0FBQTtBQWxCRCxzQ0FrQkMifQ==