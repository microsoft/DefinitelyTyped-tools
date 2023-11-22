import { isDeclarationPath } from "@definitelytyped/utils";
import { createRule } from "../util";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as TsType from "typescript";

type Program = TsType.Program;
type SourceFile = TsType.SourceFile;

const rule = createRule({
  name: "expect",
  meta: {
    type: "problem",
    docs: {
      description: "Asserts types with $ExpectType.",
    },
    messages: {
      FAILURE_STRING: `TypeScript@{{expectedVersion}} expected type to be:\n  {{expectedType}}\ngot:\n  {{actualType}}`,
      FAILURE_STRING_GENERIC: `{{message}}`,
    },
    schema: [
      {
        type: "object",
        properties: {
          runAllTypeScriptVersions: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      runAllTypeScriptVersions: false,
    },
  ],
  create(context) {
    if (isDeclarationPath(context.filename) || !context.sourceCode.text.includes("$ExpectType")) {
      return {};
    }

    const parserServices = ESLintUtils.getParserServices(context);

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Program() {
        walk(context, parserServices.program, TsType, TsType.version, undefined);
      },
    };
  },
});

type Context = Parameters<(typeof rule)["create"]>[0];

// type Messages = keyof (typeof rule)["meta"]["messages"];

function walk(
  ctx: Context,
  program: Program,
  ts: typeof TsType,
  versionName: string,
  nextHigherVersion: string | undefined,
): void {
  const { fileName } = ESLintUtils.getParserServices(ctx).esTreeNodeToTSNodeMap.get(ctx.sourceCode.ast);
  const sourceFile = program.getSourceFile(fileName)!;
  if (!sourceFile) {
    addFailureAtLine(
      0,
      `Program source files differ between TypeScript versions. This may be a dtslint bug.\n` +
        `Expected to find a file '${fileName}' present in ${TsType.version}, but did not find it in ts@${versionName}.`,
    );
    return;
  }

  const checker = program.getTypeChecker();
  // Don't care about emit errors.
  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
  for (const diagnostic of diagnostics) {
    addDiagnosticFailure(diagnostic);
  }
  if (sourceFile.isDeclarationFile || !sourceFile.text.includes("$ExpectType")) {
    // Normal file.
    return;
  }

  const { typeAssertions, duplicates } = parseAssertions(sourceFile);

  for (const line of duplicates) {
    addFailureAtLine(line, "This line has 2 $ExpectType assertions.");
  }

  const { unmetExpectations, unusedAssertions } = getExpectTypeFailures(sourceFile, typeAssertions, checker, ts);
  for (const { node, expected, actual } of unmetExpectations) {
    ctx.report({
      messageId: "FAILURE_STRING",
      data: {
        expectedType: expected,
        actualType: actual,
        expectedVersion: versionName,
      },
      loc: {
        start: ctx.sourceCode.getLocFromIndex(node.getStart(sourceFile)),
        end: ctx.sourceCode.getLocFromIndex(node.getEnd()),
      },
    });
  }
  for (const line of unusedAssertions) {
    addFailureAtLine(
      line,
      "Can not match a node to this assertion. If this is a multiline function call, ensure the assertion is on the line above.",
    );
  }

  function addDiagnosticFailure(diagnostic: TsType.Diagnostic): void {
    const intro = getIntro();
    if (diagnostic.file === sourceFile) {
      const msg = `${intro}\n${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
      ctx.report({
        messageId: "FAILURE_STRING_GENERIC",
        data: {
          message: msg,
        },
        loc: {
          start: ctx.sourceCode.getLocFromIndex(diagnostic.start!),
          end: ctx.sourceCode.getLocFromIndex(diagnostic.start! + diagnostic.length!),
        },
      });
    } else {
      ctx.report({
        messageId: "FAILURE_STRING_GENERIC",
        data: {
          message: `${intro}\n${fileName}${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
        },
        loc: {
          start: { line: 0, column: 0 },
          end: { line: 0, column: 0 },
        },
      });
    }
  }

  function getIntro(): string {
    if (nextHigherVersion === undefined) {
      return `TypeScript@${versionName} compile error: `;
    } else {
      const msg = `Compile error in typescript@${versionName} but not in typescript@${nextHigherVersion}.\n`;
      const explain =
        nextHigherVersion === "next"
          ? "TypeScript@next features not yet supported."
          : `Fix by adding '"minimumTypeScriptVersion": "${nextHigherVersion}"' to package.json.`;
      return msg + explain;
    }
  }

  function addFailureAtLine(line: number, failure: string): void {
    const start = sourceFile.getPositionOfLineAndCharacter(line, 0);
    let end = start + sourceFile.text.split("\n")[line].length;
    if (sourceFile.text[end - 1] === "\r") {
      end--;
    }
    ctx.report({
      messageId: "FAILURE_STRING_GENERIC",
      data: {
        message: `TypeScript@${versionName}: ${failure}`,
      },
      loc: {
        start: ctx.sourceCode.getLocFromIndex(start),
        end: ctx.sourceCode.getLocFromIndex(end),
      },
    });
  }
}

interface Assertions {
  /** Map from a line number to the expected type at that line. */
  readonly typeAssertions: Map<number, string>;
  /** Lines with more than one assertion (these are errors). */
  readonly duplicates: readonly number[];
}

function parseAssertions(sourceFile: SourceFile): Assertions {
  const typeAssertions = new Map<number, string>();
  const duplicates: number[] = [];

  const { text } = sourceFile;
  const commentRegexp = /\/\/(.*)/g;
  const lineStarts = sourceFile.getLineStarts();
  let curLine = 0;

  while (true) {
    const commentMatch = commentRegexp.exec(text);
    if (commentMatch === null) {
      break;
    }
    // Match on the contents of that comment so we do nothing in a commented-out assertion,
    // i.e. `// foo; // $ExpectType number`
    if (!commentMatch[1].startsWith(" $ExpectType ")) {
      continue;
    }
    const line = getLine(commentMatch.index);
    const expectedType = commentMatch[1].slice(" $ExpectType ".length);
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
  readonly unmetExpectations: readonly { node: TsType.Node; expected: string; actual: string }[];
  /** Lines with an $ExpectType, but no node could be found. */
  readonly unusedAssertions: Iterable<number>;
}

function matchReadonlyArray(actual: string, expected: string) {
  if (!(/\breadonly\b/.test(actual) && /\bReadonlyArray\b/.test(expected))) return false;
  const readonlyArrayRegExp = /\bReadonlyArray</y;
  const readonlyModifierRegExp = /\breadonly /y;

  // A<ReadonlyArray<B<ReadonlyArray<C>>>>
  // A<readonly B<readonly C[]>[]>

  let expectedPos = 0;
  let actualPos = 0;
  let depth = 0;
  while (expectedPos < expected.length && actualPos < actual.length) {
    const expectedChar = expected.charAt(expectedPos);
    const actualChar = actual.charAt(actualPos);
    if (expectedChar === actualChar) {
      expectedPos++;
      actualPos++;
      continue;
    }

    // check for end of readonly array
    if (
      depth > 0 &&
      expectedChar === ">" &&
      actualChar === "[" &&
      actualPos < actual.length - 1 &&
      actual.charAt(actualPos + 1) === "]"
    ) {
      depth--;
      expectedPos++;
      actualPos += 2;
      continue;
    }

    // check for start of readonly array
    readonlyArrayRegExp.lastIndex = expectedPos;
    readonlyModifierRegExp.lastIndex = actualPos;
    if (readonlyArrayRegExp.test(expected) && readonlyModifierRegExp.test(actual)) {
      depth++;
      expectedPos += 14; // "ReadonlyArray<".length;
      actualPos += 9; // "readonly ".length;
      continue;
    }

    return false;
  }

  return true;
}

function getExpectTypeFailures(
  sourceFile: SourceFile,
  typeAssertions: Map<number, string>,
  checker: TsType.TypeChecker,
  ts: typeof TsType,
): ExpectTypeFailures {
  const unmetExpectations: { node: TsType.Node; expected: string; actual: string }[] = [];
  // Match assertions to the first node that appears on the line they apply to.
  // `forEachChild` isn't available as a method in older TypeScript versions, so must use `ts.forEachChild` instead.
  ts.forEachChild(sourceFile, function iterate(node) {
    const line = lineOfPosition(node.getStart(sourceFile), sourceFile);
    const expected = typeAssertions.get(line);
    if (expected !== undefined) {
      // https://github.com/Microsoft/TypeScript/issues/14077
      if (node.kind === ts.SyntaxKind.ExpressionStatement) {
        node = (node as TsType.ExpressionStatement).expression;
      }

      const type = checker.getTypeAtLocation(getNodeForExpectType(node, ts));

      const actual = type
        ? checker.typeToString(type, /*enclosingDeclaration*/ undefined, ts.TypeFormatFlags.NoTruncation)
        : "";

      if (!expected.split(/\s*\|\|\s*/).some((s) => actual === s || matchReadonlyArray(actual, s))) {
        unmetExpectations.push({ node, expected, actual });
      }

      typeAssertions.delete(line);
    }

    ts.forEachChild(node, iterate);
  });
  return { unmetExpectations, unusedAssertions: typeAssertions.keys() };
}

function getNodeForExpectType(node: TsType.Node, ts: typeof TsType): TsType.Node {
  if (node.kind === ts.SyntaxKind.VariableStatement) {
    // ts2.0 doesn't have `isVariableStatement`
    const {
      declarationList: { declarations },
    } = node as TsType.VariableStatement;
    if (declarations.length === 1) {
      const { initializer } = declarations[0];
      if (initializer) {
        return initializer;
      }
    }
  }
  return node;
}

function lineOfPosition(pos: number, sourceFile: SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line;
}

export = rule;
