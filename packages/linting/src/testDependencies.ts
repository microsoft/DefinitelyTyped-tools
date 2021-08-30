import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { typeScriptPath } from "@definitelytyped/utils";
import assert = require("assert");
import { dirname, join as joinPaths, normalize } from "path";
import * as TsType from "typescript";

import { getProgram } from "./getProgram";

export type TsVersion = TypeScriptVersion | "local";

export function testDependencies(
    version: TsVersion,
    dirPath: string,
    lintProgram: TsType.Program,
    tsLocal: string | undefined,
): string | undefined {
    const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
    assert(version !== "local" || tsLocal);
    const ts: typeof TsType = require(typeScriptPath(version, tsLocal));
    const program = getProgram(tsconfigPath, ts, version, lintProgram);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => !d.file || isExternalDependency(d.file, dirPath, program));
    if (!diagnostics.length) { return undefined; }

    const showDiags = ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: f => f,
        getCurrentDirectory: () => dirPath,
        getNewLine: () => "\n",
    });

    const message = `Errors in typescript@${version} for external dependencies:\n${showDiags}`;

    // Add an edge-case for someone needing to `npm install` in react when they first edit a DT module which depends on it - #226
    const cannotFindDepsDiags = diagnostics.find(d => d.code === 2307 && d.messageText.toString().includes("Cannot find module"));
    if (cannotFindDepsDiags && cannotFindDepsDiags.file) {
        const path = cannotFindDepsDiags.file.fileName;
        const typesFolder = dirname(path);

        return `
A module look-up failed, this often occurs when you need to run \`npm install\` on a dependent module before you can lint.

Before you debug, first try running:

   npm install --prefix ${typesFolder}

Then re-run. Full error logs are below.

${message}`;
    } else {
        return message;
    }
}

function isExternalDependency(file: TsType.SourceFile, dirPath: string, program: TsType.Program): boolean {
    return !startsWithDirectory(file.fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
}

function normalizePath(file: string) {
    // replaces '\' with '/' and forces all DOS drive letters to be upper-case
    return normalize(file)
        .replace(/\\/g, "/")
        .replace(/^[a-z](?=:)/, c => c.toUpperCase());
}

function startsWithDirectory(filePath: string, dirPath: string): boolean {
    const normalFilePath = normalizePath(filePath);
    const normalDirPath = normalizePath(dirPath).replace(/\/$/, "");
    return normalFilePath.startsWith(normalDirPath + "/") || normalFilePath.startsWith(normalDirPath + "\\");
}
