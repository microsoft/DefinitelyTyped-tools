import * as path from "path";
import { ParsedCommandLine } from "typescript";
import { ensureExists } from "../common";
import { formatDiagnosticsHost } from "./formatDiagnosticsHost";

export function getParsedCommandLineForPackage(
  ts: typeof import("typescript"),
  packagePath: string
): ParsedCommandLine {
  const tsConfigPath = ensureExists(path.resolve(packagePath, "tsconfig.json"));
  const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
    tsConfigPath,
    {},
    {
      fileExists: ts.sys.fileExists,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      readDirectory: ts.sys.readDirectory,
      readFile: ts.sys.readFile,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        console.error(ts.formatDiagnostic(diagnostic, formatDiagnosticsHost));
      },
    }
  );

  if (!parsedCommandLine) {
    throw new Error(`Could not get ParsedCommandLine from config file: ${tsConfigPath}`);
  }

  return parsedCommandLine;
}
