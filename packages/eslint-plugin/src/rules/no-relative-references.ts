import { ESLintUtils } from "@typescript-eslint/utils";
import { createRule, findDtRoot, findTypesPackage } from "../util";
import * as ts from "typescript";
import path from "path";
import { DiskFS, assertDefined, createModuleResolutionHost } from "@definitelytyped/utils";

// TODO(jakebailey): is this redundant with no-bad-reference?
// Yes, it is, but this one handles imports. Need to dedupe.
// TODO(jakebailey): don't do resolution, check the paths only as relative leaving the package is the problem.
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
        'The relative import "{{text}}" resolves outside of the package; use a bare import to reference other packages.',
      relativeReference:
        'The relative reference "{{text}}" resolves outside of the package; use a global reference to reference other packages.',
    },
    schema: [],
  },
  create(context) {
    const containingFileName = context.getFilename();
    const typesPackage = findTypesPackage(containingFileName);
    if (!typesPackage) {
      return {};
    }

    const { realName: currentPackageName, dir: baseDirectory } = typesPackage;

    const dtRootPath = findDtRoot(baseDirectory);
    if (!dtRootPath) {
      return {};
    }

    const dt = new DiskFS(dtRootPath);
    const fs = new DiskFS(baseDirectory);

    const moduleResolutionHost = createModuleResolutionHost(dt, dt.debugPath());

    const tsconfig = fs.readJson("tsconfig.json");
    const configHost: ts.ParseConfigHost = {
      ...moduleResolutionHost,
      readDirectory: (dir) => fs.readdir(dir),
      useCaseSensitiveFileNames: true,
    };

    const compilerOptions = ts.parseJsonConfigFileContent(
      tsconfig,
      configHost,
      path.resolve("/", fs.debugPath())
    ).options;

    const ast = context.getSourceCode().ast;
    const parserServices = ESLintUtils.getParserServices(context, true);
    const sourceFile = parserServices.esTreeNodeToTSNodeMap.get(ast);

    const refs = findReferencedFiles(sourceFile, currentPackageName);
    for (const ref of refs) {
      // An absolute file name for use with TS resolution, e.g. '/DefinitelyTyped/types/foo/index.d.ts'
      let resolvedFileName = resolveReference(
        compilerOptions,
        moduleResolutionHost,
        baseDirectory,
        containingFileName,
        ref
      );
      if (!resolvedFileName) {
        continue;
      }
      resolvedFileName = fs.realPath(resolvedFileName);

      if (path.relative(baseDirectory, resolvedFileName).startsWith("..")) {
        // TODO(jakebailey): why bother doing this when we could just check the import path itself?
        // Relative imports can't be remapped, so we could just count ".." to see if it leaves the package.
        const pos = sourceFile.getLineAndCharacterOfPosition(ref.range.pos);
        const end = sourceFile.getLineAndCharacterOfPosition(ref.range.end);

        context.report({
          messageId: ref.kind === "import" ? "relativeImport" : "relativeReference",
          loc: {
            start: {
              line: pos.line + 1,
              column: pos.character + 1,
            },
            end: {
              line: end.line + 1,
              column: end.character + 1,
            },
          },
          data: { text: ref.text },
        });
      }
    }

    return {};
  },
});

interface Reference {
  kind: "path" | "import" | "types";
  text: string;
  resolutionMode?: ts.ModuleKind.ESNext | ts.ModuleKind.CommonJS;
  range: ts.TextRange;
}

function resolveReference(
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost,
  baseDirectory: string,
  containingFileName: string | undefined,
  { kind, text, resolutionMode }: Reference
): string | undefined {
  switch (kind) {
    case "path":
      if (containingFileName) {
        return ts.resolveTripleslashReference(text, containingFileName);
      } else {
        return path.resolve(baseDirectory, text);
      }
    case "types":
      return ts.resolveTypeReferenceDirective(
        text,
        assertDefined(containingFileName, "Must have a containing file to resolve a type reference directive"),
        compilerOptions,
        moduleResolutionHost,
        /*redirectedReference*/ undefined,
        /*cache*/ undefined,
        resolutionMode
      ).resolvedTypeReferenceDirective?.resolvedFileName;
    case "import":
      return ts.resolveModuleName(
        text,
        assertDefined(containingFileName, "Must have an containing file to resolve an import"),
        compilerOptions,
        moduleResolutionHost,
        /*cache*/ undefined,
        /*redirectedReference*/ undefined,
        resolutionMode
      ).resolvedModule?.resolvedFileName;
  }
}

function findReferencedFiles(src: ts.SourceFile, packageName: string) {
  const refs: Reference[] = [];
  for (const ref of src.referencedFiles) {
    refs.push({
      text: ref.fileName,
      kind: "path",
      resolutionMode: ref.resolutionMode,
      range: ref,
    });
  }
  for (const ref of src.typeReferenceDirectives) {
    // only <reference types="../packagename/x" /> references are local (or "packagename/x", though in 3.7 that doesn't work in DT).
    if (ref.fileName.startsWith("../" + packageName + "/") || ref.fileName.startsWith(packageName + "/")) {
      refs.push({ kind: "types", text: ref.fileName, resolutionMode: ref.resolutionMode, range: ref });
    }
  }

  for (const ref of imports(src)) {
    const resolutionMode = ts.getModeForUsageLocation(src, ref);
    if (ref.text.startsWith(".") || getMangledNameForScopedPackage(ref.text).startsWith(packageName + "/")) {
      refs.push({ kind: "import", text: ref.text, resolutionMode, range: ref });
    }
  }
  return refs;
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

// Same as the function in moduleNameResolver.ts in typescript
// TODO(jakebailey): this is a copy and paste from the definition parser
function getMangledNameForScopedPackage(packageName: string): string {
  if (packageName.startsWith("@")) {
    const replaceSlash = packageName.replace("/", "__");
    if (replaceSlash !== packageName) {
      return replaceSlash.slice(1); // Take off the "@"
    }
  }
  return packageName;
}

export = rule;
