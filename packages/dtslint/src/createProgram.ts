// This file is intentionally similar to TSLint's old Linter.createProgram API:
// https://github.com/palantir/tslint/blob/285fc1db18d1fd24680d6a2282c6445abf1566ee/src/linter.ts#L54
// TODO: creating a program to get a list of files is pretty heavyweight.

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

export function createProgram(configFile: string): ts.Program {
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error !== undefined) {
    throw new Error(
      ts.formatDiagnostics([config.error], {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: process.cwd,
        getNewLine: () => "\n",
      }),
    );
  }

  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf8"),
    useCaseSensitiveFileNames: true,
  };

  const projectDirectory = path.dirname(configFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, parseConfigHost, path.resolve(projectDirectory), {
    noEmit: true,
  });

  // ignore warnings and 'TS18003: No inputs were found in config file ...'
  const errors = parsed.errors?.filter((d) => d.category === ts.DiagnosticCategory.Error && d.code !== 18003);
  if (errors?.length) {
    throw new Error(
      ts.formatDiagnostics(errors, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: process.cwd,
        getNewLine: () => "\n",
      }),
    );
  }

  const host = ts.createCompilerHost(parsed.options, true);

  return ts.createProgram(parsed.fileNames, parsed.options, host);
}
