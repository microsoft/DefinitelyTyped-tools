import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";
import { isVersionedExpectErrorOutsideRange } from "@definitelytyped/utils";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import type { Diagnostic, Project } from "typescript-7.1/unstable/sync";
import type { Node, SourceFile } from "typescript-7.1/unstable/ast";
import type { TsVersion } from "./lint";
import { resolveLocalTypeScript } from "./typescript-installer";

type CorsaApi = typeof import("typescript-7.1/unstable/sync");
type CorsaAst = typeof import("typescript-7.1/unstable/ast");

interface Failure {
  readonly fileName?: string;
  readonly start?: number;
  readonly end?: number;
  readonly message: string;
}

const expectTypeToken = "$ExpectType";

export async function lintCorsaVersions(
  dirPath: string,
  tsconfigs: readonly string[],
  versions: readonly TsVersion[],
  isLatest: boolean,
  tsLocal: string | undefined,
  sourceFiles?: readonly string[],
): Promise<string | undefined> {
  const reportTsconfigName = tsconfigs.length !== 1 || tsconfigs[0] !== "tsconfig.json";
  const failures = new Map<string, { failure: Failure; runs: Set<string> }>();

  for (const version of versions) {
    const localTypeScript = version === "local" ? resolveLocalTypeScript(tsLocal!) : undefined;
    if (localTypeScript?.kind === "legacy") {
      throw new Error(`Expected a TypeScript package exposing unstable/sync and unstable/ast at ${tsLocal}.`);
    }
    const clientVersion = version === "local" ? TypeScriptVersion.latest : version;
    const apiPath = localTypeScript?.apiPath ?? typeScriptPackages.resolve(clientVersion, "unstable/sync");
    const astPath = localTypeScript?.astPath ?? typeScriptPackages.resolve(clientVersion, "unstable/ast");
    const apiModule = require(apiPath) as CorsaApi;
    const astModule = require(astPath) as CorsaAst;
    const rangeVersion = localTypeScript?.version ?? version;
    const api = new apiModule.API({ cwd: dirPath });
    const configPaths = tsconfigs.map((config) => path.resolve(dirPath, config));
    const matchedFiles = new Set<string>();

    try {
      const snapshot = api.updateSnapshot({ openProjects: configPaths });
      try {
        for (let i = 0; i < configPaths.length; i++) {
          const configPath = configPaths[i];
          const run = `${version} ${tsconfigs[i]}`;
          const project = snapshot.getProject(configPath);
          if (!project) {
            addFailures([{ message: `could not open ${configPath}.` }], run);
            continue;
          }
          for (const fileName of project.program.getSourceFileNames()) {
            matchedFiles.add(normalizePath(fileName));
          }
          addFailures(getDiagnosticFailures(project, dirPath, rangeVersion, isLatest), run);
          addFailures(getExpectTypeFailures(project, apiModule, astModule, dirPath, isLatest), run);
        }
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }

    for (const fileName of sourceFiles ?? []) {
      if (!matchedFiles.has(normalizePath(fileName))) {
        addFailures([{ fileName, start: 0, message: "could not find a tsconfig that includes this file." }], version);
      }
    }
  }

  return formatFailures(
    [...failures.values()].map(({ failure, runs }) => ({
      ...failure,
      message: `TypeScript@${formatRuns(runs, reportTsconfigName)} ${failure.message}`,
    })),
  );

  function addFailures(newFailures: readonly Failure[], run: string): void {
    for (const failure of newFailures) {
      const key = JSON.stringify(failure);
      let existing = failures.get(key);
      if (!existing) {
        failures.set(key, (existing = { failure, runs: new Set() }));
      }
      existing.runs.add(run);
    }
  }
}

function formatRuns(runs: ReadonlySet<string>, reportTsconfigName: boolean): string {
  return [...runs]
    .sort()
    .map((run) => (reportTsconfigName ? run : run.split(" ")[0]))
    .join(", ");
}

function getDiagnosticFailures(project: Project, dirPath: string, version: string, isLatest: boolean): Failure[] {
  const diagnostics = [
    ...project.program.getConfigFileParsingDiagnostics(),
    ...project.program.getProgramDiagnostics(),
    ...project.program.getGlobalDiagnostics(),
  ];
  const compilerOptions = project.program.getCompilerOptions();
  const checkDeclarationDiagnostics = compilerOptions.declaration || compilerOptions.composite;

  // TODO: Keep this aligned with the legacy expect rule's getPreEmitDiagnostics(program, sourceFile) calls.
  // dtslint historically reports diagnostics only for files it lints, suppressing errors inside dependencies.
  for (const fileName of project.program.getSourceFileNames()) {
    const sourceFile = project.program.getSourceFile(fileName);
    const metadata = project.program.getSourceFileMetadata(fileName);
    if (
      !sourceFile ||
      metadata?.isDefaultLibrary ||
      metadata?.isFromExternalLibrary ||
      !startsWithDirectory(fileName, dirPath) ||
      (isLatest && isTypesVersionPath(fileName, dirPath))
    ) {
      continue;
    }
    diagnostics.push(
      ...project.program.getSyntacticDiagnostics(fileName),
      ...project.program.getSemanticDiagnostics(fileName),
    );
    if (checkDeclarationDiagnostics) {
      diagnostics.push(...project.program.getDeclarationDiagnostics(fileName));
    }
  }
  const failures = new Map<string, Failure>();

  for (const diagnostic of diagnostics) {
    if (diagnostic.code === 2578 && isDiagnosticOutsideExpectErrorRange(diagnostic, project, version)) {
      continue;
    }
    const failure = {
      fileName: diagnostic.fileName,
      start: diagnostic.pos >= 0 ? diagnostic.pos : undefined,
      end: diagnostic.end >= 0 ? diagnostic.end : undefined,
      message: `compile error TS${diagnostic.code}:\n${flattenDiagnostic(diagnostic)}`,
    };
    failures.set(JSON.stringify(failure), failure);
  }
  return [...failures.values()];
}

function isDiagnosticOutsideExpectErrorRange(diagnostic: Diagnostic, project: Project, version: string): boolean {
  if (!diagnostic.fileName || diagnostic.pos < 0 || diagnostic.end < diagnostic.pos) {
    return false;
  }
  const sourceFile = project.program.getSourceFile(diagnostic.fileName);
  if (!sourceFile) {
    return false;
  }
  const text = sourceFile.text.slice(diagnostic.pos, diagnostic.end);
  return isVersionedExpectErrorOutsideRange(text, version);
}

function flattenDiagnostic(diagnostic: Diagnostic): string {
  if (!diagnostic.messageChain?.length) {
    return diagnostic.text;
  }
  return [diagnostic.text, ...diagnostic.messageChain.map(flattenDiagnostic)].join("\n");
}

function getExpectTypeFailures(
  project: Project,
  apiModule: CorsaApi,
  astModule: CorsaAst,
  dirPath: string,
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
      if (node.kind === astModule.SyntaxKind.EndOfFile) {
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
            message: `expected type to be:\n  ${expected}\ngot:\n  ${actual}`,
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
    if (ts.isTypeLiteralNode(node) && node.members.every(ts.isPropertySignature)) {
      const members = [...node.members].sort((a, b) => print(a).localeCompare(print(b)));
      return ts.factory.updateTypeLiteralNode(node, ts.factory.createNodeArray(members));
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

function getNodeForExpectType(node: Node, astModule: CorsaAst): Node {
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
