import { createRule, findTypesPackage, findUp } from "../util";
import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import type * as ts from "typescript";
import path from "path";
import fs from "fs";
import { ReportDescriptorMessageData } from "@typescript-eslint/utils/ts-eslint";
import * as semver from "semver";

type TSModule = typeof ts;

const rule = createRule({
  name: "expect",
  meta: {
    type: "problem",
    docs: {
      description: "Asserts types with $ExpectType.",
    },
    messages: {
      noTsconfig: `Could not find a tsconfig.json file.`,
      twoAssertions: "This line has 2 $ExpectType assertions.",
      failure: `TypeScript{{versionNameString}} expected type to be:\n  {{expectedType}}\ngot:\n  {{actualType}}`,
      diagnostic: `TypeScript{{versionNameString}} {{message}}`,
      noTsconfigMatch: `TypeScript{{versionNameString}} could not find a tsconfig that includes this file.`,
      noMatch:
        "Cannot match a node to this assertion. If this is a multiline function call, ensure the assertion is on the line above.",
      needInstall: `A module look-up failed, this often occurs when you need to run \`pnpm install\` on a dependent module before you can lint.

Before you debug, first try running:

   pnpm install -w --filter '...{./types/{{dirPath}}}...'

Then re-run.`,
    },
    schema: [],
  },
  defaultOptions: [{}],
  create(context) {
    const pkg = findTypesPackage(context.filename);
    if (!pkg) {
      return {};
    }

    const tsconfigPath = findUp(context.filename, (dir) => {
      const tsconfig = path.join(dir, "tsconfig.json");
      return fs.existsSync(tsconfig) ? tsconfig : undefined;
    });

    if (!tsconfigPath) {
      context.report({
        messageId: "noTsconfig",
        loc: zeroSourceLocation,
      });
      return {};
    }

    // TODO: determine TS versions to run based on this package
    const dirPath = path.dirname(tsconfigPath);

    const parserServices = ESLintUtils.getParserServices(context);

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Program(node) {
        // Grab the filename as known by TS, just to make sure we get the right normalization.
        const fileName = parserServices.esTreeNodeToTSNodeMap.get(node).fileName;
        const getLocFromIndex = (index: number) => context.sourceCode.getLocFromIndex(index);

        const settings = getSettings(context);
        let { versionsToTest } = settings;

        let reportDiagnostics = true;
        if (!versionsToTest) {
          // In the editor, just use the built-in install of TypeScript.
          versionsToTest = [{ versionName: "", path: require.resolve("typescript") }];
          reportDiagnostics = false;
        }

        let tsconfigs: readonly string[] = ["tsconfig.json"];
        let reportTsconfigName = false;
        if (pkg.packageJson.tsconfigs) {
          tsconfigs = pkg.packageJson.tsconfigs;
          reportTsconfigName = true;
          // If we're using alternative tsconfigs, the editor may not error on them.
          reportDiagnostics = true;
        }

        const toReport = new Map<string, Omit<ReporterInfo, "versionName"> & { runs: Set<VersionAndTsconfig> }>();

        for (const version of versionsToTest) {
          let found = false;
          for (const tsconfigPath of tsconfigs) {
            const ts = require(version.path) as TSModule;
            const program = getProgram(dirPath, tsconfigPath, ts, version.versionName, parserServices.program);

            const sourceFile = program.getSourceFile(fileName)!;
            if (!sourceFile) {
              continue;
            }

            found = true;

            const report: Reporter = ({ messageId, data, loc }) => {
              const key = JSON.stringify({ messageId, data, loc });
              let existing = toReport.get(key);
              if (existing === undefined) {
                toReport.set(key, (existing = { messageId, data, loc, runs: new Set() }));
              }
              existing.runs.add(`${version.versionName} ${tsconfigPath}`);
            };

            walk(
              getLocFromIndex,
              report,
              fileName,
              sourceFile,
              program,
              ts,
              version.versionName,
              /*nextHigherVersion*/ undefined,
              dirPath,
              reportDiagnostics,
            );
          }

          if (!found) {
            context.report({
              messageId: "noTsconfigMatch",
              loc: zeroSourceLocation,
            });
          }
        }

        for (const { messageId, data, loc, runs } of toReport.values()) {
          const versionNames = [...runs]
            .sort()
            .map((s) => (reportTsconfigName ? s : s.split(" ")[0]).trim())
            .join(", ");
          context.report({
            messageId,
            data: { ...data, versionNameString: versionNames ? `@${versionNames}` : "" },
            loc,
          });
        }
      },
    };
  },
});

type VersionAndTsconfig = `${string} ${string}`;

interface VersionToTest {
  readonly versionName: string;
  readonly path: string;
}

interface Settings {
  readonly versionsToTest?: readonly VersionToTest[];
}

function getSettings(context: Parameters<(typeof rule)["create"]>[0]): Settings {
  const dt = context.settings.dt ?? {};
  if (typeof dt !== "object") {
    throw new Error("Invalid dt settings");
  }

  const versionsToTest = (dt as Record<string, unknown>).versionsToTest ?? undefined;
  if (versionsToTest !== undefined && !Array.isArray(versionsToTest)) {
    throw new Error("Invalid versionsToTest");
  }

  for (const version of versionsToTest ?? []) {
    if (typeof version !== "object" || typeof version.versionName !== "string" || typeof version.path !== "string") {
      throw new Error("Invalid version to test");
    }
  }

  return { versionsToTest };
}

const programCache = new WeakMap<ts.Program, Map<VersionAndTsconfig, ts.Program>>();
/** Maps a ts.Program to one created with the version specified in `options`. */
function getProgram(
  dirPath: string,
  configFile: string,
  ts: TSModule,
  versionName: string,
  lintProgram: ts.Program,
): ts.Program {
  let versionToProgram = programCache.get(lintProgram);
  if (versionToProgram === undefined) {
    versionToProgram = new Map();
    programCache.set(lintProgram, versionToProgram);
  }

  const cacheKey: VersionAndTsconfig = `${configFile} ${versionName}`;
  let newProgram = versionToProgram.get(cacheKey);
  if (newProgram === undefined) {
    newProgram = createProgram(path.resolve(dirPath, configFile), ts);
    versionToProgram.set(cacheKey, newProgram);
  }
  return newProgram;
}

function createProgram(configFile: string, ts: TSModule): ts.Program {
  const projectDirectory = path.dirname(configFile);
  const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf8"),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(config, parseConfigHost, path.resolve(projectDirectory), {
    noEmit: true,
  });

  if (config.compilerOptions?.module?.toString().toLowerCase() === "node16" && parsed.options.module === undefined) {
    // TypeScript version is too old to handle the "node16" module option,
    // but we can run tests falling back to commonjs/node.
    parsed.options.module = ts.ModuleKind.CommonJS;
    parsed.options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  }

  const host = ts.createCompilerHost(parsed.options, true);
  return ts.createProgram(parsed.fileNames, parsed.options, host);
}

type MessageIds = keyof (typeof rule)["meta"]["messages"];

interface ReporterInfo {
  messageId: MessageIds;
  data?: ReportDescriptorMessageData;
  loc: Readonly<TSESTree.SourceLocation>;
}

type Reporter = (info: ReporterInfo) => void;

const zeroSourceLocation: Readonly<TSESTree.SourceLocation> = {
  start: { line: 0, column: 0 },
  end: { line: 0, column: 0 },
};

const expectTypeToken = "$ExpectType";

// Based on TypeScript's scanner.ts
const expectErrorSingleLine = /^\/\/\/?\s*@ts-expect-error\s+(.*)/;
const expectErrorMultiLine = /^(?:\/|\*)*\s*@ts-expect-error\s+(.*)/;

function walk(
  getLocFromIndex: (index: number) => Readonly<TSESTree.Position>,
  report: Reporter,
  fileName: string,
  sourceFile: ts.SourceFile,
  program: ts.Program,
  ts: TSModule,
  versionName: string,
  nextHigherVersion: string | undefined,
  dirPath: string,
  reportDiagnostics: boolean,
): void {
  const checker = program.getTypeChecker();

  if (reportDiagnostics) {
    // Don't care about emit errors.
    const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
    for (const diagnostic of diagnostics) {
      if (diagnostic.code === 2578) {
        // This is a ts-expect-error; parse "// @ts-expect-error <range>" and ignore when the current version is outside that range.
        const text = sourceFile.text.slice(diagnostic.start!, diagnostic.start! + diagnostic.length!);
        const match = text.match(expectErrorSingleLine) || text.match(expectErrorMultiLine);
        if (match) {
          let range: semver.Range | undefined;
          try {
            range = new semver.Range(match[1].trim());
          } catch {
            // Ignore any parsing errors.
          }

          if (range) {
            if (!semver.satisfies(versionName, range, { loose: true })) {
              continue;
            }
          }
        }
      }

      addDiagnosticFailure(diagnostic);
    }

    const cannotFindDepsDiags = diagnostics
      .filter((d) => !d.file || isExternalDependency(d.file, dirPath, program))
      .find((d) => d.code === 2307 && d.messageText.toString().includes("Cannot find module"));
    if (cannotFindDepsDiags && cannotFindDepsDiags.file) {
      const packageInfo = findTypesPackage(fileName);
      if (!packageInfo) {
        throw new Error("Could not find package info for " + fileName);
      }
      const dtRoot = findUp(packageInfo.dir, (dir) => {
        if (fs.existsSync(path.join(dir, "notNeededPackages.json"))) {
          return dir;
        }
        return undefined;
      });
      if (dtRoot) {
        const dirPath = path.relative(dtRoot, path.dirname(packageInfo.dir));
        report({
          messageId: "needInstall",
          data: { dirPath },
          loc: zeroSourceLocation,
        });
      }
    }
  }

  if (sourceFile.isDeclarationFile || !sourceFile.text.includes(expectTypeToken)) {
    // Normal file.
    return;
  }

  const { typeAssertions, duplicates } = parseAssertions(sourceFile);

  for (const line of duplicates) {
    addFailureAtLine(report, { messageId: "twoAssertions" }, line);
  }

  const { unmetExpectations, unusedAssertions } = getExpectTypeFailures(sourceFile, typeAssertions, checker, ts);
  for (const { node, expected, actual } of unmetExpectations) {
    report({
      messageId: "failure",
      data: {
        expectedType: expected,
        actualType: actual,
      },
      loc: {
        start: getLocFromIndex(node.getStart(sourceFile)),
        end: getLocFromIndex(node.getEnd()),
      },
    });
  }
  for (const line of unusedAssertions) {
    addFailureAtLine(
      report,
      {
        messageId: "noMatch",
      },
      line - 1,
    );
  }

  function addDiagnosticFailure(diagnostic: ts.Diagnostic): void {
    const intro = getIntro();
    if (diagnostic.file === sourceFile) {
      const msg = `${intro}\n${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
      report({
        messageId: "diagnostic",
        data: { message: msg },
        loc: {
          start: getLocFromIndex(diagnostic.start!),
          end: getLocFromIndex(diagnostic.start! + diagnostic.length!),
        },
      });
    } else {
      report({
        messageId: "diagnostic",
        data: { message: `${intro}\n${fileName}${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}` },
        loc: zeroSourceLocation,
      });
    }
  }

  function getIntro(): string {
    if (nextHigherVersion === undefined) {
      return `compile error: `;
    } else {
      const msg = `Compile error in typescript@${versionName} but not in typescript@${nextHigherVersion}.\n`;
      const explain =
        nextHigherVersion === "next"
          ? "TypeScript@next features not yet supported."
          : `Fix by adding '"minimumTypeScriptVersion": "${nextHigherVersion}"' to package.json.`;
      return msg + explain;
    }
  }

  function addFailureAtLine(report: Reporter, info: Omit<ReporterInfo, "loc">, line: number): void {
    const start = sourceFile.getPositionOfLineAndCharacter(line, 0);
    let end = start + sourceFile.text.split("\n")[line].length;
    if (sourceFile.text[end - 1] === "\r") {
      end--;
    }
    report({
      ...info,
      loc: {
        start: getLocFromIndex(start),
        end: getLocFromIndex(end),
      },
    });
  }
}

// TODO(jakebailey): dedupe these copied frunctions from dtslint
function normalizePath(file: string) {
  // replaces '\' with '/' and forces all DOS drive letters to be upper-case
  return path
    .normalize(file)
    .replace(/\\/g, "/")
    .replace(/^[a-z](?=:)/, (c) => c.toUpperCase());
}

function startsWithDirectory(filePath: string, dirPath: string): boolean {
  const normalFilePath = normalizePath(filePath);
  const normalDirPath = normalizePath(dirPath).replace(/\/$/, "");
  return normalFilePath.startsWith(normalDirPath + "/") || normalFilePath.startsWith(normalDirPath + "\\");
}

function isExternalDependency(file: ts.SourceFile, dirPath: string, program: ts.Program): boolean {
  return !startsWithDirectory(file.fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
}

interface Assertions {
  /** Map from a line number to the expected type at that line. */
  readonly typeAssertions: Map<number, string>;
  /** Lines with more than one assertion (these are errors). */
  readonly duplicates: readonly number[];
}

function parseAssertions(sourceFile: ts.SourceFile): Assertions {
  const typeAssertions = new Map<number, string>();
  const duplicates: number[] = [];

  const { text } = sourceFile;
  const commentRegexp = /^(.*?)\/\/(.*)$/gm;
  const lineStarts = sourceFile.getLineStarts();
  let curLine = 0;

  while (true) {
    const commentMatch = commentRegexp.exec(text);
    if (commentMatch === null) {
      break;
    }
    const comment = commentMatch[2].trim();
    if (!comment.startsWith(expectTypeToken)) {
      continue;
    }
    const line = getLine(commentMatch.index + commentMatch[1].length);
    const expectedType = comment.slice(expectTypeToken.length).trim();
    // Don't bother with the assertion if there are 2 assertions on 1 line. Just fail for the duplicate.
    if (typeAssertions.delete(line)) {
      duplicates.push(line);
    } else {
      typeAssertions.set(line, expectedType);
    }
  }

  return { typeAssertions, duplicates };

  function getLine(pos: number): number {
    // advance curLine to be the line preceding 'pos'
    while (lineStarts[curLine + 1] <= pos) {
      curLine++;
    }
    // If this is the first token on the line, it applies to the next line.
    // Otherwise, it applies to the text to the left of it.
    return isFirstOnLine(text, lineStarts[curLine], pos) ? curLine + 1 : curLine;
  }
}

function isFirstOnLine(text: string, lineStart: number, pos: number): boolean {
  for (let i = lineStart; i < pos; i++) {
    if (text[i] !== " ") {
      return false;
    }
  }
  return true;
}

interface ExpectTypeFailures {
  /** Lines with an $ExpectType, but a different type was there. */
  readonly unmetExpectations: readonly { node: ts.Node; expected: string; actual: string }[];
  /** Lines with an $ExpectType, but no node could be found. */
  readonly unusedAssertions: Iterable<number>;
}

function getExpectTypeFailures(
  sourceFile: ts.SourceFile,
  typeAssertions: Map<number, string>,
  checker: ts.TypeChecker,
  ts: TSModule,
): ExpectTypeFailures {
  const unmetExpectations: { node: ts.Node; expected: string; actual: string }[] = [];
  // Match assertions to the first node that appears on the line they apply to.
  // `forEachChild` isn't available as a method in older TypeScript versions, so must use `ts.forEachChild` instead.
  ts.forEachChild(sourceFile, function iterate(node) {
    if (node.kind === ts.SyntaxKind.EndOfFileToken) {
      return;
    }

    const line = lineOfPosition(node.getStart(sourceFile), sourceFile);
    const expected = typeAssertions.get(line);
    if (expected !== undefined) {
      // https://github.com/Microsoft/TypeScript/issues/14077
      if (node.kind === ts.SyntaxKind.ExpressionStatement) {
        node = (node as ts.ExpressionStatement).expression;
      }

      const type = checker.getTypeAtLocation(getNodeForExpectType(node, ts));

      const actual = type
        ? checker.typeToString(type, /*enclosingDeclaration*/ undefined, ts.TypeFormatFlags.NoTruncation)
        : "";

      let actualNormalized: string | undefined;

      const candidates = expected.split(/\s*\|\|\s*/).map((s) => s.trim());

      if (
        !(
          // Fast path
          (
            candidates.some((s) => s === actual) ||
            candidates.some((s) => {
              actualNormalized ??= normalizedTypeToString(ts, actual);
              const normalized = normalizedTypeToString(ts, s);
              return normalized === actualNormalized;
            })
          )
        )
      ) {
        unmetExpectations.push({ node, expected, actual });
      }

      typeAssertions.delete(line);
    }

    ts.forEachChild(node, iterate);
  });
  return { unmetExpectations, unusedAssertions: typeAssertions.keys() };
}

function normalizedTypeToString(ts: TSModule, type: string) {
  const sourceFile = ts.createSourceFile("foo.ts", `declare var x: ${type};`, ts.ScriptTarget.Latest);
  const typeNode = (sourceFile.statements[0] as ts.VariableStatement).declarationList.declarations[0].type!;

  const printer = ts.createPrinter({});
  function print(node: ts.Node) {
    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  }
  // TODO: pass undefined instead once https://github.com/microsoft/TypeScript/pull/52941 is released
  const context = (ts as any).nullTransformationContext;

  function visit(node: ts.Node) {
    node = ts.visitEachChild(node, visit, context);

    if (ts.isUnionTypeNode(node)) {
      const types = node.types
        .map((t) => [t, print(t)] as const)
        .sort((a, b) => (a[1] < b[1] ? -1 : 1))
        .map((t) => t[0]);
      return ts.factory.updateUnionTypeNode(node, ts.factory.createNodeArray(types));
    }

    if (
      ts.isTypeOperatorNode(node) &&
      node.operator === ts.SyntaxKind.ReadonlyKeyword &&
      ts.isArrayTypeNode(node.type)
    ) {
      // It's possible that this would conflict with a library which defines their own type with this name,
      // but that's unlikely (and was not previously handled in a prior revision of type string normalization).
      return ts.factory.createTypeReferenceNode("ReadonlyArray", [skipTypeParentheses(ts, node.type.elementType)]);
    }

    return node;
  }

  const visited = visit(typeNode);
  return print(visited);
}

function skipTypeParentheses(ts: TSModule, node: ts.TypeNode): ts.TypeNode {
  while (ts.isParenthesizedTypeNode(node)) node = node.type;
  return node;
}

function getNodeForExpectType(node: ts.Node, ts: TSModule): ts.Node {
  if (node.kind === ts.SyntaxKind.VariableStatement) {
    // ts2.0 doesn't have `isVariableStatement`
    const {
      declarationList: { declarations },
    } = node as ts.VariableStatement;
    if (declarations.length === 1) {
      const { initializer } = declarations[0];
      if (initializer) {
        return initializer;
      }
    }
  }
  return node;
}

function lineOfPosition(pos: number, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line;
}

export = rule;
