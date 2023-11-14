import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { createRule, findTypesPackage } from "../util";
import * as ts from "typescript";
import path from "path";
import { isDeclarationPath } from "@definitelytyped/utils";

interface Reference {
  kind: "path" | "import" | "types";
  text: string;
  range: ts.TextRange;
}

const rule = createRule({
  name: "no-bad-reference",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbids bad references, including those that resolve outside of the package or path references in non-declaration files.",
    },
    messages: {
      importOutside:
        'The import "{{text}}" resolves outside of the package. Use a bare import to reference other packages.',
      importLeaves: 'The import "{{text}}" resolves to the current package, but uses relative paths.',
      referenceOutside:
        'The reference "{{text}}" resolves outside of the package. Use a global reference to reference other packages.',
      referenceLeaves: 'The reference "{{text}}" resolves to the current package, but uses relative paths.',
      testReference:
        'The path reference "{{text}}" is disallowed outside declaration files. Use "<reference types>" or include the file in tsconfig instead.',
      backslashes: "Use forward slashes in paths.",
    },
    schema: [],
  },
  create(context) {
    const containingFileName = context.getFilename();
    const typesPackage = findTypesPackage(containingFileName);
    if (!typesPackage) {
      return {};
    }

    const containingDirectory = path.dirname(containingFileName);

    const realNamePlusSlash = typesPackage.realName + "/";
    function isRelativeOrSelf(name: string) {
      return name.startsWith(".") || name.startsWith(realNamePlusSlash);
    }

    const ast = context.getSourceCode().ast;
    const parserServices = ESLintUtils.getParserServices(context, true);
    const sourceFile = parserServices.esTreeNodeToTSNodeMap.get(ast);

    const refs: Reference[] = [];
    for (const ref of sourceFile.referencedFiles) {
      if (isDeclarationPath(containingFileName)) {
        refs.push({ kind: "path", text: ref.fileName, range: ref });
      } else {
        context.report({
          messageId: "testReference",
          loc: tsRangeToESLintLocation(ref, sourceFile),
          data: { text: ref.fileName },
        });
      }
    }
    for (const ref of sourceFile.typeReferenceDirectives) {
      if (isRelativeOrSelf(ref.fileName)) {
        refs.push({ kind: "types", text: ref.fileName, range: ref });
      }
    }
    for (const ref of imports(sourceFile)) {
      if (isRelativeOrSelf(ref.text)) {
        refs.push({ kind: "import", text: ref.text, range: { pos: ref.getStart(), end: ref.getEnd() } });
      }
    }

    for (const ref of refs) {
      if (ref.text.includes("\\")) {
        context.report({
          messageId: "backslashes",
          loc: tsRangeToESLintLocation(ref.range, sourceFile),
        });
      }

      const p = ref.text.startsWith(realNamePlusSlash)
        ? path.posix.join(
            path.posix.relative(containingDirectory, typesPackage.dir),
            ref.text.slice(realNamePlusSlash.length),
          )
        : ref.text;

      const resolved = path.resolve(containingDirectory, p);
      const otherPackage = findTypesPackage(resolved);

      if (otherPackage && otherPackage.dir === typesPackage.dir) {
        // Perf trick; if a path doesn't have ".." anywhere, then it can't have resolved
        // up and out of a package dir so we can skip this work.
        if (p.includes("..")) {
          // If we resolved to something in the correct package, we still could have
          // gotten here by leaving the package (up into a parent, or down into a versioned dir).
          // Manually walk the path to see if that happened.
          const parts = p.split("/");
          let cwd = containingDirectory;
          for (const part of parts) {
            if (part === "" || part === ".") {
              continue;
            }
            if (part === "..") {
              cwd = path.posix.dirname(cwd);
            } else {
              cwd = path.posix.join(cwd, part);
            }
            const otherPackage = findTypesPackage(cwd);
            if (otherPackage && otherPackage.dir === typesPackage.dir) {
              continue;
            }

            context.report({
              messageId: ref.kind === "import" ? "importLeaves" : "referenceLeaves",
              loc: tsRangeToESLintLocation(ref.range, sourceFile),
              data: { text: ref.text },
            });
          }
        }

        continue;
      }

      context.report({
        messageId: ref.kind === "import" ? "importOutside" : "referenceOutside",
        loc: tsRangeToESLintLocation(ref.range, sourceFile),
        data: { text: ref.text },
      });
    }

    return {};
  },
});

function tsRangeToESLintLocation(range: ts.TextRange, sourceFile: ts.SourceFile): TSESTree.SourceLocation {
  const pos = sourceFile.getLineAndCharacterOfPosition(range.pos);
  const end = sourceFile.getLineAndCharacterOfPosition(range.end);
  return {
    // line is 1 indexed, but column is 0 indexed. >.<
    start: { line: pos.line + 1, column: pos.character },
    end: { line: end.line + 1, column: end.character },
  };
}

/**
 * All strings referenced in `import` statements.
 * Does *not* include <reference> directives.
 */
function imports({ statements }: ts.SourceFile): Iterable<ts.StringLiteralLike> {
  const result: ts.StringLiteralLike[] = [];
  for (const node of statements) {
    recur(node);
  }
  return result;

  function recur(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ExportDeclaration: {
        const { moduleSpecifier } = node as ts.ImportDeclaration | ts.ExportDeclaration;
        if (moduleSpecifier && moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
          result.push(moduleSpecifier as ts.StringLiteral);
        }
        break;
      }

      case ts.SyntaxKind.ImportEqualsDeclaration: {
        const { moduleReference } = node as ts.ImportEqualsDeclaration;
        if (moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
          result.push(parseRequire(moduleReference));
        }
        break;
      }

      case ts.SyntaxKind.ImportType: {
        const { argument } = node as ts.ImportTypeNode;
        if (ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)) {
          result.push(argument.literal);
        }
        break;
      }

      default:
        ts.forEachChild(node, recur);
    }
  }
}

function parseRequire(reference: ts.ExternalModuleReference): ts.StringLiteralLike {
  const { expression } = reference;
  if (!expression || !ts.isStringLiteral(expression)) {
    throw new Error(`Bad 'import =' reference: ${reference.getText()}`);
  }
  return expression;
}

export = rule;
