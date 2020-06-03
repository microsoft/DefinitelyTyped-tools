import assert = require("assert");
import * as path from "path";
import * as ts from "typescript";
import { sort, joinPaths, FS, normalizeSlashes, hasWindowsSlashes } from "@definitelytyped/utils";

import { readFileAndThrowOnBOM } from "./definition-parser";

export function getModuleInfo(packageName: string, all: Map<string, ts.SourceFile>): ModuleInfo {
  const dependencies = new Set<string>();
  const declaredModules: string[] = [];
  const globals = new Set<string>();

  function addDependency(ref: string): void {
    if (ref.startsWith(".")) {
      return;
    }
    const dependency = rootName(ref, all, packageName);
    if (dependency !== packageName) {
      dependencies.add(dependency);
    }
  }

  for (const sourceFile of all.values()) {
    for (const ref of imports(sourceFile)) {
      addDependency(ref);
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
  return statements.some(statement => {
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
  dependencies: Set<string>;
  // Anything from a `declare module "foo"`
  declaredModules: string[];
  // Every global symbol
  globals: string[];
}

/**
 * Given a file name, get the name of the module it declares.
 * `foo/index.d.ts` declares "foo", `foo/bar.d.ts` declares "foo/bar", "foo/bar/index.d.ts" declares "foo/bar"
 */
function properModuleName(folderName: string, fileName: string): string {
  const part = path.basename(fileName) === "index.d.ts" ? path.dirname(fileName) : withoutExtension(fileName, ".d.ts");
  return part === "." ? folderName : joinPaths(folderName, part);
}

/**
 * "foo/bar/baz" -> "foo"; "@foo/bar/baz" -> "@foo/bar"
 * Note: Throws an error for references like
 * "bar/v3" because referencing old versions of *other* packages is illegal;
 * those directories won't exist in the published @types package.
 */
function rootName(importText: string, typeFiles: Map<string, unknown>, packageName: string): string {
  let slash = importText.indexOf("/");
  // Root of `@foo/bar/baz` is `@foo/bar`
  if (importText.startsWith("@")) {
    // Use second "/"
    slash = importText.indexOf("/", slash + 1);
  }
  const root = importText.slice(0, slash);
  const postImport = importText.slice(slash + 1);
  if (slash > -1 && postImport.match(/v\d+$/) && !typeFiles.has(postImport + ".d.ts") && root !== packageName) {
    throw new Error(`${importText}: do not directly import specific versions of another types package.
You should work with the latest version of ${root} instead.`);
  }
  return slash === -1 ? importText : root;
}

function withoutExtension(str: string, ext: string): string {
  assert(str.endsWith(ext));
  return str.slice(0, str.length - ext.length);
}

/** Returns a map from filename (path relative to `directory`) to the SourceFile we parsed for it. */
export function allReferencedFiles(
  entryFilenames: readonly string[],
  fs: FS,
  packageName: string,
  baseDirectory: string
): { types: Map<string, ts.SourceFile>; tests: Map<string, ts.SourceFile> } {
  const seenReferences = new Set<string>();
  const types = new Map<string, ts.SourceFile>();
  const tests = new Map<string, ts.SourceFile>();
  entryFilenames.forEach(text => recur({ text, exact: true }));
  return { types, tests };

  function recur({ text, exact }: Reference): void {
    if (seenReferences.has(text)) {
      return;
    }
    seenReferences.add(text);

    const resolvedFilename = exact ? text : resolveModule(text, fs);
    // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
    if (fs.exists(resolvedFilename)) {
      const src = createSourceFile(resolvedFilename, readFileAndThrowOnBOM(resolvedFilename, fs));
      if (resolvedFilename.endsWith(".d.ts")) {
        types.set(resolvedFilename, src);
      } else {
        tests.set(resolvedFilename, src);
      }

      const refs = findReferencedFiles(
        src,
        packageName,
        path.dirname(resolvedFilename),
        normalizeSlashes(path.relative(baseDirectory, fs.debugPath()))
      );
      refs.forEach(recur);
    }
  }
}

function resolveModule(importSpecifier: string, fs: FS): string {
  importSpecifier = importSpecifier.endsWith("/")
    ? importSpecifier.slice(0, importSpecifier.length - 1)
    : importSpecifier;
  if (importSpecifier !== "." && importSpecifier !== "..") {
    // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
    if (fs.exists(importSpecifier + ".d.ts")) {
      return importSpecifier + ".d.ts";
    }
    // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
    if (fs.exists(importSpecifier + ".ts")) {
      return importSpecifier + ".ts";
    }
    // tslint:disable-next-line:non-literal-fs-path -- Not a reference to the fs package
    if (fs.exists(importSpecifier + ".tsx")) {
      return importSpecifier + ".tsx";
    }
  }
  return importSpecifier === "." ? "index.d.ts" : joinPaths(importSpecifier, "index.d.ts");
}

interface Reference {
  /** <reference path> includes exact filename, so true. import "foo" may reference "foo.d.ts" or "foo/index.d.ts", so false. */
  readonly exact: boolean;
  text: string;
}

/**
 * @param subDirectory The specific directory within the DefinitelyTyped directory we are in.
 * For example, `baseDirectory` may be `react-router` and `subDirectory` may be `react-router/lib`.
 * versionsBaseDirectory may be "" when not in typesVersions or ".." when inside `react-router/ts3.1`
 */
function findReferencedFiles(src: ts.SourceFile, packageName: string, subDirectory: string, baseDirectory: string) {
  const refs: Reference[] = [];

  for (const ref of src.referencedFiles) {
    // Any <reference path="foo"> is assumed to be local
    addReference({ text: ref.fileName, exact: true });
  }
  for (const ref of src.typeReferenceDirectives) {
    // only <reference types="../packagename/x" /> references are local (or "packagename/x", though in 3.7 that doesn't work in DT).
    if (ref.fileName.startsWith("../" + packageName + "/")) {
      addReference({ text: ref.fileName, exact: false });
    } else if (ref.fileName.startsWith(packageName + "/")) {
      addReference({ text: convertToRelativeReference(ref.fileName), exact: false });
    }
  }

  for (const ref of imports(src)) {
    if (ref.startsWith(".")) {
      addReference({ text: ref, exact: false });
    }
    if (ref.startsWith(packageName + "/")) {
      addReference({ text: convertToRelativeReference(ref), exact: false });
    }
  }
  return refs;

  function addReference(ref: Reference): void {
    // `path.normalize` may add windows slashes
    const full = normalizeSlashes(
      path.normalize(joinPaths(subDirectory, assertNoWindowsSlashes(src.fileName, ref.text)))
    );
    // allow files in typesVersions directories (i.e. 'ts3.1') to reference files in parent directory
    if (full.startsWith("../" + packageName + "/")) {
      ref.text = full.slice(packageName.length + 4);
      refs.push(ref);
      return;
    }
    if (
      full.startsWith("..") &&
      (baseDirectory === "" || path.normalize(joinPaths(baseDirectory, full)).startsWith(".."))
    ) {
      throw new Error(
        `${src.fileName}: ` +
          'Definitions must use global references to other packages, not parent ("../xxx") references.' +
          `(Based on reference '${ref.text}')`
      );
    }
    ref.text = full;
    refs.push(ref);
  }

  /** boring/foo -> ./foo when subDirectory === '.'; ../foo when it's === 'x'; ../../foo when it's 'x/y' */
  function convertToRelativeReference(name: string) {
    const relative = "." + "/..".repeat(subDirectory === "." ? 0 : subDirectory.split("/").length);
    return relative + name.slice(packageName.length);
  }
}

/**
 * All strings referenced in `import` statements.
 * Does *not* include <reference> directives.
 */
function* imports({ statements }: ts.SourceFile | ts.ModuleBlock): Iterable<string> {
  for (const node of statements) {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ExportDeclaration: {
        const { moduleSpecifier } = node as ts.ImportDeclaration | ts.ExportDeclaration;
        if (moduleSpecifier && moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
          yield (moduleSpecifier as ts.StringLiteral).text;
        }
        break;
      }

      case ts.SyntaxKind.ImportEqualsDeclaration: {
        const { moduleReference } = node as ts.ImportEqualsDeclaration;
        if (moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
          yield parseRequire(moduleReference);
        }
        break;
      }

      case ts.SyntaxKind.ModuleDeclaration: {
        const { name, body } = node as ts.ModuleDeclaration;
        if (name.kind === ts.SyntaxKind.StringLiteral && body) {
          yield* imports(body as ts.ModuleBlock);
        }
        break;
      }

      default:
    }
  }
}

function parseRequire(reference: ts.ExternalModuleReference): string {
  const { expression } = reference;
  if (!expression || !ts.isStringLiteral(expression)) {
    throw new Error(`Bad 'import =' reference: ${reference.getText()}`);
  }
  return expression.text;
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
  typeFiles: Map<string, unknown>,
  testFiles: Iterable<string>,
  dependencies: ReadonlySet<string>,
  fs: FS
): Iterable<string> {
  const testDependencies = new Set<string>();
  for (const filename of testFiles) {
    const content = readFileAndThrowOnBOM(filename, fs);
    const sourceFile = createSourceFile(filename, content);
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
      if (!imported.startsWith(".")) {
        const dep = rootName(imported, typeFiles, packageName);
        if (!dependencies.has(dep) && dep !== packageName) {
          testDependencies.add(dep);
        }
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

export function createSourceFile(filename: string, content: string): ts.SourceFile {
  return ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, /*setParentNodes*/ false);
}
