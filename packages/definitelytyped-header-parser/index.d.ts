/// <reference types="parsimmon" />
import pm = require("parsimmon");
export declare type TypeScriptVersion = "2.0" | "2.1" | "2.2";
export declare namespace TypeScriptVersion {
    const All: TypeScriptVersion[];
    const Lowest = "2.0";
    /** Latest version that may be specified in a `// TypeScript Version:` header. */
    const Latest = "2.2";
    /** True if a package with the given typescript version should be published as prerelease. */
    function isPrerelease(version: TypeScriptVersion): boolean;
    /** List of NPM tags that should be changed to point to the latest version. */
    function tagsToUpdate(typeScriptVersion: TypeScriptVersion): string[];
}
export interface Header {
    libraryName: string;
    libraryMajorVersion: number;
    libraryMinorVersion: number;
    typeScriptVersion: TypeScriptVersion;
    projects: string[];
    contributors: Author[];
}
export interface Author {
    name: string;
    url: string;
}
export interface ParseError {
    index: number;
    line: number;
    column: number;
    expected: string[];
}
export declare function parseHeaderOrFail(mainFileContent: string): Header;
export declare function validate(mainFileContent: string): ParseError | undefined;
export declare function renderExpected(expected: string[]): string;
export declare function parseTypeScriptVersionLine(line: string): TypeScriptVersion;
declare module "parsimmon" {
    type Pr<T> = pm.Parser<T>;
    function seqMap<T, U, V, W, X, Y, Z, A, B, C>(p1: Pr<T>, p2: Pr<U>, p3: Pr<V>, p4: Pr<W>, p5: Pr<X>, p6: Pr<Y>, p7: Pr<Z>, p8: Pr<A>, p9: Pr<B>, cb: (a1: T, a2: U, a3: V, a4: W, a5: X, a6: Y, a7: Z, a8: A, a9: B) => C): Pr<C>;
}
