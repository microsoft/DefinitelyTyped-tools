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
const formatDiagnosticsHost_1 = require("./formatDiagnosticsHost");
function getParsedCommandLineForPackage(ts, packagePath) {
    const tsConfigPath = common_1.ensureExists(path.resolve(packagePath, 'tsconfig.json'));
    const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(tsConfigPath, {}, {
        fileExists: ts.sys.fileExists,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        readDirectory: ts.sys.readDirectory,
        readFile: ts.sys.readFile,
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        onUnRecoverableConfigFileDiagnostic: diagnostic => {
            console.error(ts.formatDiagnostic(diagnostic, formatDiagnosticsHost_1.formatDiagnosticsHost));
        },
    });
    if (!parsedCommandLine) {
        throw new Error(`Could not get ParsedCommandLine from config file: ${tsConfigPath}`);
    }
    return parsedCommandLine;
}
exports.getParsedCommandLineForPackage = getParsedCommandLineForPackage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UGFyc2VkQ29tbWFuZExpbmVGb3JQYWNrYWdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL21lYXN1cmUvZ2V0UGFyc2VkQ29tbWFuZExpbmVGb3JQYWNrYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDJDQUE2QjtBQUU3QixzQ0FBeUM7QUFDekMsbUVBQWdFO0FBRWhFLFNBQWdCLDhCQUE4QixDQUFDLEVBQStCLEVBQUUsV0FBbUI7SUFDakcsTUFBTSxZQUFZLEdBQUcscUJBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDO0lBQzlFLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDLGdDQUFnQyxDQUFDLFlBQVksRUFBRSxFQUFFLEVBQUU7UUFDOUUsVUFBVSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsVUFBVTtRQUM3QixtQkFBbUIsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUMvQyxhQUFhLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxhQUFhO1FBQ25DLFFBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVE7UUFDekIseUJBQXlCLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUI7UUFDM0QsbUNBQW1DLEVBQUUsVUFBVSxDQUFDLEVBQUU7WUFDaEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLDZDQUFxQixDQUFDLENBQUMsQ0FBQztRQUN4RSxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1FBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELFlBQVksRUFBRSxDQUFDLENBQUM7S0FDdEY7SUFFRCxPQUFPLGlCQUFpQixDQUFDO0FBQzNCLENBQUM7QUFsQkQsd0VBa0JDIn0=