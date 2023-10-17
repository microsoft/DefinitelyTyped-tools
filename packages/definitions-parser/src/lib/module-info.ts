import * as path from "path";
import * as ts from "typescript";
import { FS, assertDefined } from "@definitelytyped/utils";

import { readFileAndThrowOnBOM } from "./definition-parser";
import { getMangledNameForScopedPackage } from "../packages";

/** Returns a map from filename (path relative to `directory`) to the SourceFile we parsed for it. */
export function allReferencedFiles(
  entryFilenames: readonly string[],
  fs: FS,
  packageName: string,
  moduleResolutionHost: ts.ModuleResolutionHost,
  compilerOptions: ts.CompilerOptions
): { types: Map<string, ts.SourceFile>; tests: Set<string> } {
  const seenReferences = new Set<string>();
  const types = new Map<string, ts.SourceFile>();
  const tests = new Set<string>();
  // The directory where the tsconfig/index.d.ts is - i.e., may be a version within the package
  const baseDirectory = path.resolve("/", fs.debugPath());
  // The root of the package and all versions, i.e., the direct subdirectory of types/
  const packageDirectory = baseDirectory.slice(
    0,
    baseDirectory.lastIndexOf(`types/${getMangledNameForScopedPackage(packageName)}`) +
      `types/${getMangledNameForScopedPackage(packageName)}`.length
  );
  entryFilenames.forEach((fileName) => recur(undefined, { text: fileName, kind: "path" }));
  return { types, tests };

  function recur(containingFileName: string | undefined, ref: Reference): void {
    // An absolute file name for use with TS resolution, e.g. '/DefinitelyTyped/types/foo/index.d.ts'
    let resolvedFileName = resolveReference(containingFileName, ref);
    if (!resolvedFileName) {
      return;
    }
    resolvedFileName = fs.realPath(resolvedFileName);

    if (seenReferences.has(resolvedFileName)) {
      return;
    }
    seenReferences.add(resolvedFileName);

    // E.g. 'index.d.ts' - suitable for lookups in `fs` and for our result
    const relativeFileName = path.relative(baseDirectory, resolvedFileName);
    if (path.relative(packageDirectory, resolvedFileName).startsWith("..")) {
      // We only collected references that started with the current package name or were relative,
      // so if we resolve an import to something outside the package, we know it was a relative
      // import to a different package.
      throw new Error(
        `${containingFileName ?? "tsconfig.json"}: ` +
          'Definitions must use global references to other packages, not parent ("../xxx") references. ' +
          `(Based on reference '${ref.text}')`
      );
    }

    // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
    if (fs.exists(relativeFileName)) {
      const src = createSourceFile(
        resolvedFileName,
        readFileAndThrowOnBOM(relativeFileName, fs),
        moduleResolutionHost,
        compilerOptions
      );
      if (
        relativeFileName.endsWith(".d.ts") ||
        relativeFileName.endsWith(".d.mts") ||
        relativeFileName.endsWith(".d.cts")
      ) {
        types.set(relativeFileName, src);
      } else {
        tests.add(relativeFileName);
      }

      const refs = findReferencedFiles(src, packageName);
      refs.forEach((ref) => recur(resolvedFileName, ref));
    }
  }

  function resolveReference(
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
}

interface Reference {
  kind: "path" | "import" | "types";
  text: string;
  resolutionMode?: ts.ModuleKind.ESNext | ts.ModuleKind.CommonJS;
}

/**
 * @param subDirectory The specific directory within the DefinitelyTyped directory we are in.
 * For example, `baseDirectory` may be `react-router` and `subDirectory` may be `react-router/lib`.
 * versionsBaseDirectory may be "" when not in typesVersions or ".." when inside `react-router/ts3.1`
 */
function findReferencedFiles(src: ts.SourceFile, packageName: string) {
  const refs: Reference[] = [];
  for (const ref of src.referencedFiles) {
    refs.push({
      text: ref.fileName,
      kind: "path",
      resolutionMode: ref.resolutionMode,
    });
  }
  for (const ref of src.typeReferenceDirectives) {
    // only <reference types="../packagename/x" /> references are local (or "packagename/x", though in 3.7 that doesn't work in DT).
    if (ref.fileName.startsWith("../" + packageName + "/") || ref.fileName.startsWith(packageName + "/")) {
      refs.push({ kind: "types", text: ref.fileName, resolutionMode: ref.resolutionMode });
    }
  }

  for (const ref of imports(src)) {
    const resolutionMode = ts.getModeForUsageLocation(src, ref);
    if (ref.text.startsWith(".") || getMangledNameForScopedPackage(ref.text).startsWith(packageName + "/")) {
      refs.push({ kind: "import", text: ref.text, resolutionMode });
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

function isValueNamespace(ns: ts.ModuleDeclaration): boolean {
  if (!ns.body) {
    throw new Error("@types should not use shorthand ambient modules");
  }
  return ns.body.kind === ts.SyntaxKind.ModuleDeclaration
    ? isValueNamespace(ns.body as ts.ModuleDeclaration)
    : (ns.body as ts.ModuleBlock).statements.some(statementDeclaresValue);
}

function statementDeclaresValue(statement: ts.Statement): boolean {
  switch (statement.kind) {
    case ts.SyntaxKind.VariableStatement:
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.EnumDeclaration:
      return true;

    case ts.SyntaxKind.ModuleDeclaration:
      return isValueNamespace(statement as ts.ModuleDeclaration);

    case ts.SyntaxKind.InterfaceDeclaration:
    case ts.SyntaxKind.TypeAliasDeclaration:
    case ts.SyntaxKind.ImportEqualsDeclaration:
      return false;

    default:
      throw new Error(`Forgot to implement ambient namespace statement ${ts.SyntaxKind[statement.kind]}`);
  }
}

export function createSourceFile(
  filename: string,
  content: string,
  moduleResolutionHost: ts.ModuleResolutionHost,
  compilerOptions: ts.CompilerOptions
): ts.SourceFile {
  const file = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, /*setParentNodes*/ true);
  file.impliedNodeFormat = ts.getImpliedNodeFormatForFile(
    filename as ts.Path,
    /*packageJsonInfoCache*/ undefined,
    moduleResolutionHost,
    compilerOptions
  );
  return file;
}
