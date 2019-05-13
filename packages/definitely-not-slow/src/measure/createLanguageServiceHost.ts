import * as path from 'path';
import { CompilerOptions, LanguageServiceHost } from 'typescript';
import { ensureExists } from '../common';
const basePath = path.resolve(__dirname, '../../..');

export function createLanguageServiceHost(
  ts: typeof import('typescript'),
  compilerOptions: CompilerOptions,
  testPaths: string[],
): LanguageServiceHost {
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
    getScriptSnapshot: fileName => ts.ScriptSnapshot.fromString(ts.sys.readFile(ensureExists(fileName))!),
    getScriptVersion: () => (version++).toString(),
  };
}