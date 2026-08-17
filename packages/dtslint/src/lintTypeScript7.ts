import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";
import fs from "fs";
import path from "path";
import semver from "semver";
import { pathToFileURL } from "url";
import * as ts from "typescript";
import type { TsVersion } from "./lint";

interface Node {
  readonly kind: number;
  readonly parent: Node;
  forEachChild(visitor: (node: Node) => void): void;
  getStart(sourceFile?: SourceFile): number;
  getEnd(): number;
}

interface ExpressionStatement extends Node {
  readonly expression: Node;
}

interface VariableStatement extends Node {
  readonly declarationList: {
    readonly declarations: readonly {
      readonly initializer?: Node;
    }[];
  };
}

interface SourceFile extends Node {
  readonly fileName: string;
  readonly text: string;
  readonly isDeclarationFile: boolean;
  getLineStarts(): readonly number[];
  getLineAndCharacterOfPosition(position: number): { line: number; character: number };
  getPositionOfLineAndCharacter(line: number, character: number): number;
}

interface Diagnostic {
  readonly fileName?: string;
  readonly pos: number;
  readonly end: number;
  readonly code: number;
  readonly text: string;
  readonly messageChain?: readonly Diagnostic[];
}

interface Program {
  getSourceFile(fileName: string): SourceFile | undefined;
  getSourceFileNames(): readonly string[];
  getSourceFileMetadata(fileName: string): { isDefaultLibrary: boolean; isFromExternalLibrary: boolean } | undefined;
  getSyntacticDiagnostics(): readonly Diagnostic[];
  getBindDiagnostics(): readonly Diagnostic[];
  getSemanticDiagnostics(): readonly Diagnostic[];
  getDeclarationDiagnostics(): readonly Diagnostic[];
  getProgramDiagnostics(): readonly Diagnostic[];
  getGlobalDiagnostics(): readonly Diagnostic[];
  getConfigFileParsingDiagnostics(): readonly Diagnostic[];
}

interface Project {
  readonly program: Program;
  readonly checker: {
    getTypeAtLocation(node: Node): unknown | undefined;
    typeToString(type: unknown, enclosingDeclaration: undefined, flags: number): string;
  };
}

interface Snapshot {
  getProject(configFileName: string): Project | undefined;
  dispose(): void;
}

interface TypeScript7Api {
  readonly NodeBuilderFlags: { readonly NoTruncation: number };
  readonly API: new (options: { cwd: string; tsserverPath?: string }) => {
    updateSnapshot(options: { openProjects: readonly string[] }): Snapshot;
    close(): void;
  };
}

interface TypeScript7Ast {
  readonly SyntaxKind: { readonly EndOfFileToken: number };
  isExpressionStatement(node: Node): node is ExpressionStatement;
  isVariableStatement(node: Node): node is VariableStatement;
}

interface Failure {
  readonly fileName?: string;
  readonly start?: number;
  readonly end?: number;
  readonly message: string;
}

const expectTypeToken = "$ExpectType";
const expectErrorSingleLine = /^\/\/\/?\s*@ts-expect-error\s+(.*)/;
const expectErrorMultiLine = /^(?:\/|\*)*\s*@ts-expect-error\s+(.*)/;

export async function lintTypeScript7(
  dirPath: string,
  tsconfigs: readonly string[],
  version: TsVersion,
  isLatest: boolean,
  tsLocal: string | undefined,
): Promise<string | undefined> {
  const clientVersion = version === "local" ? TypeScriptVersion.latest : version;
  const [apiModule, astModule] = await Promise.all([
    importModule<TypeScript7Api>(typeScriptPackages.resolve(clientVersion, "unstable/sync")),
    importModule<TypeScript7Ast>(typeScriptPackages.resolve(clientVersion, "unstable/ast")),
  ]);
  const tsserverPath = version === "local" ? findTypeScript7Server(tsLocal!) : undefined;
  const api = new apiModule.API({ cwd: dirPath, tsserverPath });
  const configPaths = tsconfigs.map((config) => path.resolve(dirPath, config));
  const failures: Failure[] = [];

  try {
    const snapshot = api.updateSnapshot({ openProjects: configPaths });
    try {
      for (const configPath of configPaths) {
        const project = snapshot.getProject(configPath);
        if (!project) {
          failures.push({
            message: `TypeScript@${version} could not open ${configPath}.`,
          });
          continue;
        }
        failures.push(...getDiagnosticFailures(project, version));
        failures.push(...getExpectTypeFailures(project, apiModule, astModule, dirPath, version, isLatest));
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }

  return formatFailures(failures);
}

async function importModule<T>(fileName: string): Promise<T> {
  return (await import(pathToFileURL(fileName).href)) as T;
}

function findTypeScript7Server(tsLocal: string): string {
  if (fs.statSync(tsLocal).isFile()) {
    return tsLocal;
  }
  for (const name of ["tsserver", "tsserver.exe", "tsgo", "tsgo.exe"]) {
    const candidate = path.join(tsLocal, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find a TypeScript 7 tsserver/tsgo executable in ${tsLocal}.`);
}

function getDiagnosticFailures(project: Project, version: TsVersion): Failure[] {
  const diagnostics = [
    ...project.program.getConfigFileParsingDiagnostics(),
    ...project.program.getProgramDiagnostics(),
    ...project.program.getGlobalDiagnostics(),
    ...project.program.getSyntacticDiagnostics(),
    ...project.program.getBindDiagnostics(),
    ...project.program.getSemanticDiagnostics(),
    ...project.program.getDeclarationDiagnostics(),
  ];
  const failures = new Map<string, Failure>();

  for (const diagnostic of diagnostics) {
    if (diagnostic.code === 2578 && isVersionedExpectErrorOutsideRange(diagnostic, project, version)) {
      continue;
    }
    const failure = {
      fileName: diagnostic.fileName,
      start: diagnostic.pos >= 0 ? diagnostic.pos : undefined,
      end: diagnostic.end >= 0 ? diagnostic.end : undefined,
      message: `TypeScript@${version} compile error TS${diagnostic.code}:\n${flattenDiagnostic(diagnostic)}`,
    };
    failures.set(JSON.stringify(failure), failure);
  }
  return [...failures.values()];
}

function isVersionedExpectErrorOutsideRange(diagnostic: Diagnostic, project: Project, version: TsVersion): boolean {
  if (!diagnostic.fileName || diagnostic.pos < 0 || diagnostic.end < diagnostic.pos) {
    return false;
  }
  const sourceFile = project.program.getSourceFile(diagnostic.fileName);
  if (!sourceFile) {
    return false;
  }
  const text = sourceFile.text.slice(diagnostic.pos, diagnostic.end);
  const match = text.match(expectErrorSingleLine) || text.match(expectErrorMultiLine);
  if (!match) {
    return false;
  }
  try {
    return !semver.satisfies(version, match[1].trim(), { loose: true });
  } catch {
    return false;
  }
}

function flattenDiagnostic(diagnostic: Diagnostic): string {
  if (!diagnostic.messageChain?.length) {
    return diagnostic.text;
  }
  return [diagnostic.text, ...diagnostic.messageChain.map(flattenDiagnostic)].join("\n");
}

function getExpectTypeFailures(
  project: Project,
  apiModule: TypeScript7Api,
  astModule: TypeScript7Ast,
  dirPath: string,
  version: TsVersion,
  isLatest: boolean,
): Failure[] {
  const failures: Failure[] = [];
  for (const fileName of project.program.getSourceFileNames()) {
    const sourceFile = project.program.getSourceFile(fileName);
    const metadata = project.program.getSourceFileMetadata(fileName);
    if (
      !sourceFile ||
      metadata?.isDefaultLibrary ||
      metadata?.isFromExternalLibrary ||
      !startsWithDirectory(fileName, dirPath) ||
      (isLatest && isTypesVersionPath(fileName, dirPath)) ||
      sourceFile.isDeclarationFile ||
      !sourceFile.text.includes(expectTypeToken)
    ) {
      continue;
    }

    const { typeAssertions, duplicates } = parseAssertions(sourceFile);
    for (const line of duplicates) {
      failures.push(failureAtLine(sourceFile, line, "This line has 2 $ExpectType assertions."));
    }

    sourceFile.forEachChild(function visit(node) {
      if (node.kind === astModule.SyntaxKind.EndOfFileToken) {
        return;
      }
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
      const expected = typeAssertions.get(line);
      if (expected !== undefined) {
        const target = getNodeForExpectType(node, astModule);
        const type = project.checker.getTypeAtLocation(target);
        const actual =
          type === undefined
            ? ""
            : project.checker.typeToString(type, undefined, apiModule.NodeBuilderFlags.NoTruncation);
        if (!typeStringsMatch(expected, actual)) {
          failures.push({
            fileName,
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            message: `TypeScript@${version} expected type to be:\n  ${expected}\ngot:\n  ${actual}`,
          });
        }
        typeAssertions.delete(line);
      }
      node.forEachChild(visit);
    });

    for (const line of typeAssertions.keys()) {
      failures.push(
        failureAtLine(
          sourceFile,
          line - 1,
          "Cannot match a node to this assertion. If this is a multiline function call, ensure the assertion is on the line above.",
        ),
      );
    }
  }
  return failures;
}

function typeStringsMatch(expected: string, actual: string): boolean {
  const candidates = expected.split(/\s*\|\|\s*/).map((candidate) => candidate.trim());
  if (candidates.includes(actual)) {
    return true;
  }
  const actualNormalized = normalizedTypeToString(actual);
  return candidates.some((candidate) => normalizedTypeToString(candidate) === actualNormalized);
}

function normalizedTypeToString(type: string): string {
  const sourceFile = ts.createSourceFile("type.ts", `declare var x: ${type};`, ts.ScriptTarget.Latest);
  const typeNode = (sourceFile.statements[0] as ts.VariableStatement).declarationList.declarations[0].type!;
  const printer = ts.createPrinter({});
  const context = (ts as typeof ts & { nullTransformationContext: ts.TransformationContext }).nullTransformationContext;

  function print(node: ts.Node): string {
    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  }
  function visit(node: ts.Node): ts.VisitResult<ts.Node> {
    node = ts.visitEachChild(node, visit, context);
    if (ts.isUnionTypeNode(node)) {
      const types = node.types
        .map((item) => [item, print(item)] as const)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([item]) => item);
      return ts.factory.updateUnionTypeNode(node, ts.factory.createNodeArray(types));
    }
    if (
      ts.isTypeOperatorNode(node) &&
      node.operator === ts.SyntaxKind.ReadonlyKeyword &&
      ts.isArrayTypeNode(node.type)
    ) {
      return ts.factory.createTypeReferenceNode("ReadonlyArray", [skipTypeParentheses(node.type.elementType)]);
    }
    return node;
  }

  return print(ts.visitNode(typeNode, visit));
}

function skipTypeParentheses(node: ts.TypeNode): ts.TypeNode {
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }
  return node;
}

function getNodeForExpectType(node: Node, astModule: TypeScript7Ast): Node {
  if (astModule.isExpressionStatement(node)) {
    return node.expression;
  }
  if (astModule.isVariableStatement(node) && node.declarationList.declarations.length === 1) {
    return node.declarationList.declarations[0].initializer ?? node;
  }
  return node;
}

interface Assertions {
  readonly typeAssertions: Map<number, string>;
  readonly duplicates: readonly number[];
}

function parseAssertions(sourceFile: SourceFile): Assertions {
  const typeAssertions = new Map<number, string>();
  const duplicates: number[] = [];
  const commentRegexp = /^(.*?)\/\/(.*)$/gm;
  const lineStarts = sourceFile.getLineStarts();
  let currentLine = 0;

  while (true) {
    const commentMatch = commentRegexp.exec(sourceFile.text);
    if (!commentMatch) {
      break;
    }
    const comment = commentMatch[2].trim();
    if (!comment.startsWith(expectTypeToken)) {
      continue;
    }
    const commentPosition = commentMatch.index + commentMatch[1].length;
    while (lineStarts[currentLine + 1] <= commentPosition) {
      currentLine++;
    }
    const line = isFirstOnLine(sourceFile.text, lineStarts[currentLine], commentPosition)
      ? currentLine + 1
      : currentLine;
    const expectedType = comment.slice(expectTypeToken.length).trim();
    if (typeAssertions.delete(line)) {
      duplicates.push(line);
    } else {
      typeAssertions.set(line, expectedType);
    }
  }
  return { typeAssertions, duplicates };
}

function isFirstOnLine(text: string, lineStart: number, position: number): boolean {
  for (let i = lineStart; i < position; i++) {
    if (text[i] !== " ") {
      return false;
    }
  }
  return true;
}

function failureAtLine(sourceFile: SourceFile, line: number, message: string): Failure {
  const start = sourceFile.getPositionOfLineAndCharacter(line, 0);
  let end = start + sourceFile.text.split("\n")[line].length;
  if (sourceFile.text[end - 1] === "\r") {
    end--;
  }
  return { fileName: sourceFile.fileName, start, end, message };
}

function formatFailures(failures: readonly Failure[]): string | undefined {
  if (!failures.length) {
    return undefined;
  }
  return failures
    .map((failure) => {
      if (!failure.fileName || failure.start === undefined) {
        return failure.message;
      }
      const text = fs.readFileSync(failure.fileName, "utf8");
      const sourceFile = ts.createSourceFile(failure.fileName, text, ts.ScriptTarget.Latest);
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(failure.start);
      return `${failure.fileName}:${line + 1}:${character + 1}\n${failure.message}`;
    })
    .join("\n\n");
}

function normalizePath(fileName: string): string {
  return path
    .normalize(fileName)
    .replace(/\\/g, "/")
    .replace(/^[a-z](?=:)/, (character) => character.toUpperCase());
}

function startsWithDirectory(fileName: string, dirPath: string): boolean {
  const normalizedFileName = normalizePath(fileName);
  const normalizedDirPath = normalizePath(dirPath).replace(/\/$/, "");
  return normalizedFileName.startsWith(normalizedDirPath + "/");
}

function isTypesVersionPath(fileName: string, dirPath: string): boolean {
  const subdirPath = normalizePath(fileName).slice(normalizePath(dirPath).length);
  return /^\/ts\d+\.\d/.test(subdirPath);
}
