"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const common_1 = require("../common");
const basePath = path.resolve(__dirname, '../../..');
function createLanguageServiceHost(ts, compilerOptions, testPaths) {
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
        getScriptSnapshot: fileName => ts.ScriptSnapshot.fromString(ts.sys.readFile(common_1.ensureExists(fileName))),
        getScriptVersion: () => (version++).toString(),
    };
}
exports.createLanguageServiceHost = createLanguageServiceHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlTGFuZ3VhZ2VTZXJ2aWNlSG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9tZWFzdXJlL2NyZWF0ZUxhbmd1YWdlU2VydmljZUhvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsMkNBQTZCO0FBRTdCLHNDQUF5QztBQUN6QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUVyRCxTQUFnQix5QkFBeUIsQ0FDdkMsRUFBK0IsRUFDL0IsZUFBZ0MsRUFDaEMsU0FBbUI7SUFFbkIsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ2hCLE9BQU87UUFDTCxlQUFlLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1FBQ3ZDLHNCQUFzQixFQUFFLEdBQUcsRUFBRSxDQUFDLGVBQWU7UUFDN0MsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDL0MscUJBQXFCLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsc0NBQXNDLENBQUM7UUFDM0YsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTztRQUNoQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO1FBQ25DLFVBQVUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVU7UUFDN0IsY0FBYyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsY0FBYztRQUNyQyxpQkFBaUIsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHFCQUFZLENBQUMsUUFBUSxDQUFDLENBQUUsQ0FBQztRQUNyRyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0tBQy9DLENBQUM7QUFDSixDQUFDO0FBbEJELDhEQWtCQyJ9