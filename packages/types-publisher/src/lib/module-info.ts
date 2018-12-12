import assert = require("assert");
import * as path from "path";
import * as ts from "typescript";

import { FS } from "../get-definitely-typed";
import { hasWindowsSlashes, joinPaths, normalizeSlashes, sort } from "../util/util";

import { readFileAndThrowOnBOM } from "./definition-parser";

export default async function getModuleInfo(
    packageName: string, packageDirectory: string, allEntryFilenames: ReadonlyArray<string>,
    fs: FS): Promise<ModuleInfo> {
    const all = await allReferencedFiles(allEntryFilenames, fs, packageDirectory);

    const dependencies = new Set<string>();
    const declaredModules: string[] = [];
    const globals = new Set<string>();

    function addDependency(dependency: string): void {
        if (dependency !== packageName) {
            dependencies.add(dependency);
        }
        // TODO: else throw new Error(`Package ${packageName} references itself. (via ${src.fileName})`);
    }

    for (const sourceFile of all.values()) {
        for (const ref of imports(sourceFile)) {
            if (!ref.startsWith(".")) {
                addDependency(rootName(ref));
            }
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

    return { declFiles: sort(all.keys()), dependencies, declaredModules, globals: sort(globals) };
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
    // Every declaration file used (starting from the entry point)
    declFiles: string[];
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

/** Given "foo/bar/baz", return "foo". */
function rootName(importText: string): string {
    let slash = importText.indexOf("/");
    // Root of `@foo/bar/baz` is `@foo/bar`
    if (importText.startsWith("@")) {
        // Use second "/"
        slash = importText.indexOf("/", slash + 1);
    }
    return slash === -1 ? importText : importText.slice(0, slash);
}

function withoutExtension(str: string, ext: string): string {
    assert(str.endsWith(ext));
    return str.slice(0, str.length - ext.length);
}

/** Returns a map from filename (path relative to `directory`) to the SourceFile we parsed for it. */
async function allReferencedFiles(entryFilenames: ReadonlyArray<string>, fs: FS, baseDirectory: string): Promise<Map<string, ts.SourceFile>> {
    const seenReferences = new Set<string>();
    const all = new Map<string, ts.SourceFile>();

    async function recur({ text, exact }: Reference): Promise<void> {
        if (seenReferences.has(text)) {
            return;
        }
        seenReferences.add(text);

        const resolvedFilename = exact ? text : await resolveModule(text, fs);
        const src = createSourceFile(resolvedFilename, await readFileAndThrowOnBOM(resolvedFilename, fs));
        all.set(resolvedFilename, src);

        const refs = findReferencedFiles(src, path.dirname(resolvedFilename), normalizeSlashes(path.relative(baseDirectory, fs.debugPath())));
        await Promise.all(Array.from(refs).map(recur));
    }

    await Promise.all(entryFilenames.map(filename => recur({ text: filename, exact: true })));
    return all;
}

async function resolveModule(importSpecifier: string, fs: FS): Promise<string> {
    const dts = `${importSpecifier}.d.ts`;
    if (![".", "..", "./", "../"].includes(importSpecifier) && await fs.exists(dts)) {
        return dts;
    } else {
        const index = joinPaths(importSpecifier.endsWith("/") ? importSpecifier.slice(0, importSpecifier.length - 1) : importSpecifier, "index.d.ts");
        return index === "./index.d.ts" ?  "index.d.ts" : index;
    }
}

interface Reference {
    /** <reference path> includes exact filename, so true. import "foo" may reference "foo.d.ts" or "foo/index.d.ts", so false. */
    readonly exact: boolean;
    text: string;
}

/**
 * @param subDirectory The specific directory within the DefinitelyTyped directory we are in.
 * For example, `directory` may be `react-router` and `subDirectory` may be `react-router/lib`.
 */
function* findReferencedFiles(src: ts.SourceFile, subDirectory: string, baseDirectory: string): Iterable<Reference> {
    for (const ref of src.referencedFiles) {
        // Any <reference path="foo"> is assumed to be local
        yield addReference({ text: ref.fileName, exact: true });
    }

    for (const ref of imports(src)) {
        if (ref.startsWith(".")) {
            yield addReference({ text: ref, exact: false });
        }
    }

    function addReference(ref: Reference): Reference {
        // `path.normalize` may add windows slashes
        const full = normalizeSlashes(path.normalize(joinPaths(subDirectory, assertNoWindowsSlashes(src.fileName, ref.text))));
        // allow files in typesVersions directories (i.e. 'ts3.1') to reference files in parent directory
        if (full.startsWith("..") && (baseDirectory === "" || path.normalize(joinPaths(baseDirectory, full)).startsWith(".."))) {
            throw new Error(
                `${src.fileName}: ` +
                'Definitions must use global references to other packages, not parent ("../xxx") references.' +
                `(Based on reference '${ref.text}')`);
        }
        ref.text = full;
        return ref;
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

export async function getTestDependencies(
    pkgName: string,
    testFiles: Iterable<string>,
    dependencies: ReadonlySet<string>,
    fs: FS,
): Promise<Iterable<string>> {
    const testDependencies = new Set<string>();

    for (const filename of testFiles) {
        const content = await readFileAndThrowOnBOM(filename, fs);
        const sourceFile = createSourceFile(filename, content);
        const { fileName, referencedFiles, typeReferenceDirectives } = sourceFile;
        const filePath = () => path.join(pkgName, fileName);

        for (const { fileName: ref } of referencedFiles) {
            throw new Error(`Test files should not use '<reference path="" />'. '${filePath()}' references '${ref}'.`);
        }

        for (const { fileName: referencedPackage } of typeReferenceDirectives) {
            if (dependencies.has(referencedPackage)) {
                throw new Error(`'${filePath()}' unnecessarily references '${referencedPackage}', which is already referenced in the type definition.`);
            }
            if (referencedPackage === pkgName) {
                throw new Error(`'${filePath()}' unnecessarily references the package. This can be removed.`);
            }

            testDependencies.add(referencedPackage);
        }

        for (const imported of imports(sourceFile)) {
            if (!imported.startsWith(".") && !dependencies.has(imported) && imported !== pkgName) {
                testDependencies.add(imported);
            }
        }
    }

    return testDependencies;
}

function createSourceFile(filename: string, content: string): ts.SourceFile {
    return ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, /*setParentNodes*/false);
}
