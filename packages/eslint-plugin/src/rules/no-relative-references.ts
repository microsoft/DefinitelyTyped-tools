import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { createRule, findTypesPackage } from "../util";
import * as ts from "typescript";
import path from "path";

// TODO(jakebailey): is this redundant with no-bad-reference?
// Yes, it is, but this one handles imports. Need to dedupe.
const rule = createRule({
  name: "no-relative-references",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids relative references that resolve outside of the package.",
      recommended: "error",
    },
    messages: {
      relativeImport:
        'The import "{{text}}" resolves outside of the package; use a bare import to reference other packages.',
      relativeReference:
        'The reference "{{text}}" resolves outside of the package; use a global reference to reference other packages.',
    },
    schema: [],
  },
  create(context) {
    const containingFileName = context.getFilename();
    const typesPackage = findTypesPackage(containingFileName);
    if (!typesPackage) {
      return {};
    }

    const realNamePlusSlash = typesPackage.realName + "/";
    function isRelativeOrSelf(name: string) {
      return name.startsWith(".") || name.startsWith(realNamePlusSlash);
    }

    const ast = context.getSourceCode().ast;
    const parserServices = ESLintUtils.getParserServices(context, true);
    const sourceFile = parserServices.esTreeNodeToTSNodeMap.get(ast);

    const refs: Reference[] = [];
    for (const ref of sourceFile.referencedFiles) {
      refs.push({ kind: "path", text: ref.fileName, range: ref });
    }
    for (const ref of sourceFile.typeReferenceDirectives) {
      if (isRelativeOrSelf(ref.fileName)) {
        refs.push({ kind: "types", text: ref.fileName, range: ref });
      }
    }
    for (const ref of imports(sourceFile)) {
      if (isRelativeOrSelf(ref.text)) {
        refs.push({ kind: "import", text: ref.text, range: ref });
      }
    }

    for (const ref of refs) {
      const p = ref.text.startsWith(realNamePlusSlash)
        ? path.posix.join(typesPackage.dir, ref.text.slice(realNamePlusSlash.length))
        : ref.text;

      // TODO(jakebailey): Rather than using path.resolve, manually walk each
      // part seeing if any of them escape the package, which would let us
      // catch places where people relatively move out of the package and back
      // in again.
      //
      // As a perf trick, we can use path.resolve if the path doesn't contain
      // ".."; then we know that it could only ever go into a child package.
      const resolved = path.resolve(path.dirname(containingFileName), p);
      const otherPackage = findTypesPackage(resolved);

      if (otherPackage && otherPackage.dir === typesPackage.dir) {
        continue;
      }

      context.report({
        messageId: ref.kind === "import" ? "relativeImport" : "relativeReference",
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
    start: { line: pos.line + 1, column: pos.character + 1 },
    end: { line: end.line + 1, column: end.character + 1 },
  };
}

interface Reference {
  kind: "path" | "import" | "types";
  text: string;
  range: ts.TextRange;
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
