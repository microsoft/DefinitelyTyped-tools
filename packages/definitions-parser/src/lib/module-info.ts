import assert = require("assert");
import * as path from "path";
import * as ts from "typescript";
import { sort, joinPaths, FS, hasWindowsSlashes, assertDefined } from "@definitelytyped/utils";

import { readFileAndThrowOnBOM } from "./definition-parser";
import { getMangledNameForScopedPackage } from "../packages";

export function getModuleInfo(packageName: string, all: Map<string, ts.SourceFile>): ModuleInfo {
  const dependencies = new Set<string>();
  const declaredModules: string[] = [];
  const globals = new Set<string>();

  function addDependency(ref: string): void {
    if (!ref.startsWith(".")) {
      dependencies.add(ref);
    }
  }

  for (const sourceFile of all.values()) {
    for (const ref of imports(sourceFile)) {
      addDependency(ref.text);
    }
    for (const ref of sourceFile.typeReferenceDirectives) {
      addDependency(ref.fileName);
    }
    if (ts.isExternalModule(sourceFile)) {
      if (sourceFileExportsSomething(sourceFile)) {
        declaredModules.push(properModuleName(packageName, sourceFile.fileName));
        const namespaceExport = sourceFile.statements.find(ts.isNamespaceExportDeclaration);
        if (namespaceExport) {
          globals.add(namespaceExport.name.text);
        }
      }
    } else {
      for (const node of sourceFile.statements) {
        switch (node.kind) {
          case ts.SyntaxKind.ModuleDeclaration: {
            const decl = node as ts.ModuleDeclaration;
            const name = decl.name.text;
            if (decl.name.kind === ts.SyntaxKind.StringLiteral) {
              declaredModules.push(assertNoWindowsSlashes(packageName, name));
            } else if (isValueNamespace(decl)) {
              globals.add(name);
            }
            break;
          }
          case ts.SyntaxKind.VariableStatement:
            for (const decl of (node as ts.VariableStatement).declarationList.declarations) {
              if (decl.name.kind === ts.SyntaxKind.Identifier) {
                globals.add(decl.name.text);
              }
            }
            break;
          case ts.SyntaxKind.EnumDeclaration:
          case ts.SyntaxKind.ClassDeclaration:
          case ts.SyntaxKind.FunctionDeclaration: {
            // Deliberately not doing this for types, because those won't show up in JS code and can't be used for ATA
            const nameNode = (node as ts.EnumDeclaration | ts.ClassDeclaration | ts.FunctionDeclaration).name;
            if (nameNode) {
              globals.add(nameNode.text);
            }
            break;
          }
          case ts.SyntaxKind.ImportEqualsDeclaration:
          case ts.SyntaxKind.InterfaceDeclaration:
          case ts.SyntaxKind.TypeAliasDeclaration:
          case ts.SyntaxKind.EmptyStatement:
            break;
          default:
            throw new Error(`Unexpected node kind ${ts.SyntaxKind[node.kind]}`);
        }
      }
    }
  }

  return { dependencies, declaredModules, globals: sort(globals) };
}

/**
 * A file is a proper module if it is an external module *and* it has at least one export.
 * A module with only imports is not a proper module; it likely just augments some other module.
 */
function sourceFileExportsSomething({ statements }: ts.SourceFile): boolean {
  return statements.some((statement) => {
    switch (statement.kind) {
      case ts.SyntaxKind.ImportEqualsDeclaration:
      case ts.SyntaxKind.ImportDeclaration:
        return false;
      case ts.SyntaxKind.ModuleDeclaration:
        return (statement as ts.ModuleDeclaration).name.kind === ts.SyntaxKind.Identifier;
      default:
        return true;
    }
  });
}

interface ModuleInfo {
  /** Full (possibly deep) module specifiers of dependencies (imports, type references, etc.). */
  dependencies: Set<string>;
  /** Anything from a `declare module "foo"` */
  declaredModules: string[];
  /** Every global symbol */
  globals: string[];
}

const extensions: Map<string, string> = new Map();
extensions.set(".d.ts", ""); // TODO: Inaccurate?
extensions.set(".d.mts", ".mjs");
extensions.set(".d.cts", ".cjs");

/**
 * Given a file name, get the name of the module it declares.
 * `foo/index.d.ts` declares "foo", `foo/bar.d.ts` declares "foo/bar", "foo/bar/index.d.ts" declares "foo/bar"
 */
function properModuleName(folderName: string, fileName: string): string {
  const part =
    path.basename(fileName) === "index.d.ts" ? path.dirname(fileName) : withoutExtensions(fileName, extensions);
  return part === "." ? folderName : joinPaths(folderName, part);
}

function withoutExtensions(str: string, exts: typeof extensions): string {
  const entries = Array.from(exts.entries());
  const ext = entries.find(([e, _]) => str.endsWith(e));
  assert(ext, `file "${str}" should end with extension ${entries.map(([e, _]) => `"${e}"`).join(", ")}`);
  return str.slice(0, str.length - ext[0].length) + ext[1];
}

/** Returns a map from filename (path relative to `directory`) to the SourceFile we parsed for it. */
export function allReferencedFiles(
  entryFilenames: readonly string[],
  fs: FS,
  packageName: string,
  moduleResolutionHost: ts.ModuleResolutionHost,
  compilerOptions: ts.CompilerOptions
): { types: Map<string, ts.SourceFile>; tests: Map<string, ts.SourceFile>; hasNonRelativeImports: boolean } {
  const seenReferences = new Set<string>();
  const types = new Map<string, ts.SourceFile>();
  const tests = new Map<string, ts.SourceFile>();
  // The directory where the tsconfig/index.d.ts is - i.e., may be a version within the package
  const baseDirectory = path.resolve("/", fs.debugPath());
  // The root of the package and all versions, i.e., the direct subdirectory of types/
  const packageDirectory = baseDirectory.slice(
    0,
    baseDirectory.lastIndexOf(`types/${getMangledNameForScopedPackage(packageName)}`) +
      `types/${getMangledNameForScopedPackage(packageName)}`.length
  );
  let hasNonRelativeImports = false;
  entryFilenames.forEach((fileName) => recur(undefined, { text: fileName, kind: "path" }));
  return { types, tests, hasNonRelativeImports };

  function recur(containingFileName: string | undefined, ref: Reference): void {
    // An absolute file name for use with TS resolution, e.g. '/DefinitelyTyped/types/foo/index.d.ts'
    const resolvedFileName = resolveReference(containingFileName, ref);

    if (!resolvedFileName) {
      return;
    }

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
        tests.set(relativeFileName, src);
      }

      const { refs, hasNonRelativeImports: result } = findReferencedFiles(src, packageName);
      refs.forEach((ref) => recur(resolvedFileName, ref));
      hasNonRelativeImports = hasNonRelativeImports || result;
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
  let hasNonRelativeImports = false;

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
      hasNonRelativeImports = !ref.text.startsWith(".");
    }
  }
  return { refs, hasNonRelativeImports };
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

function assertNoWindowsSlashes(packageName: string, fileName: string): string {
  if (hasWindowsSlashes(fileName)) {
    throw new Error(`In ${packageName}: Use forward slash instead when referencing ${fileName}`);
  }
  return fileName;
}

export function getTestDependencies(
  packageName: string,
  testFiles: Iterable<string>,
  dependencies: ReadonlySet<string>,
  fs: FS,
  moduleResolutionHost: ts.ModuleResolutionHost,
  compilerOptions: ts.CompilerOptions
): Iterable<string> {
  const testDependencies = new Set<string>();
  for (const filename of testFiles) {
    const content = readFileAndThrowOnBOM(filename, fs);
    const sourceFile = createSourceFile(filename, content, moduleResolutionHost, compilerOptions);
    const { fileName, referencedFiles, typeReferenceDirectives } = sourceFile;
    const filePath = () => path.join(packageName, fileName);
    let hasImports = false;
    let isModule = false;
    let referencesSelf = false;

    for (const { fileName: ref } of referencedFiles) {
      throw new Error(`Test files should not use '<reference path="" />'. '${filePath()}' references '${ref}'.`);
    }
    for (const { fileName: referencedPackage } of typeReferenceDirectives) {
      if (dependencies.has(referencedPackage)) {
        throw new Error(
          `'${filePath()}' unnecessarily references '${referencedPackage}', which is already referenced in the type definition.`
        );
      }
      if (referencedPackage === packageName) {
        referencesSelf = true;
      }
      testDependencies.add(referencedPackage);
    }
    for (const imported of imports(sourceFile)) {
      hasImports = true;
      if (!imported.text.startsWith(".") && !dependencies.has(imported.text)) {
        testDependencies.add(imported.text);
      }
    }

    isModule =
      hasImports ||
      (() => {
        // Note that this results in files without imports to be walked twice,
        // once in the `imports(...)` function, and once more here:
        for (const node of sourceFile.statements) {
          if (node.kind === ts.SyntaxKind.ExportAssignment || node.kind === ts.SyntaxKind.ExportDeclaration) {
            return true;
          }
        }
        return false;
      })();

    if (isModule && referencesSelf) {
      throw new Error(`'${filePath()}' unnecessarily references the package. This can be removed.`);
    }
  }
  return testDependencies;
}

export function createSourceFile(
  filename: string,
  content: string,
  moduleResolutionHost: ts.ModuleResolutionHost,
  compilerOptions: ts.CompilerOptions
): ts.SourceFile {
  const file = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, /*setParentNodes*/ false);
  file.impliedNodeFormat = ts.getImpliedNodeFormatForFile(
    filename as ts.Path,
    /*packageJsonInfoCache*/ undefined,
    moduleResolutionHost,
    compilerOptions
  );
  return file;
}
