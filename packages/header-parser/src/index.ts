import pm = require("parsimmon");
import { AllTypeScriptVersion, TypeScriptVersion } from "@definitelytyped/typescript-versions";

/*

  # Example header format #

  // Type definitions for foo 1.2
  // Project: https://github.com/foo/foo, https://foo.com
  // Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
  // Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
  // TypeScript Version: 2.1

*/

export interface Header {
  readonly nonNpm: boolean;
  readonly libraryName: string;
  readonly libraryMajorVersion: number;
  readonly libraryMinorVersion: number;
  readonly typeScriptVersion: AllTypeScriptVersion;
  readonly projects: readonly string[];
  readonly contributors: readonly Author[];
}

export interface Author {
  readonly name: string;
  readonly url: string;
  readonly githubUsername: string | undefined;
}

export interface ParseError {
  readonly index: number;
  readonly line: number;
  readonly column: number;
  readonly expected: readonly string[];
}

export function makeTypesVersionsForPackageJson(typesVersions: readonly TypeScriptVersion[]): unknown {
  if (typesVersions.length === 0) {
    return undefined;
  }

  const oldestFirst = typesVersions.slice();
  oldestFirst.sort((v1, v2) => (v1 > v2 ? 1 : v1 < v2 ? -1 : 0));
  const out: { [key: string]: { readonly "*": readonly string[] } } = {};
  for (const version of oldestFirst) {
    out[`<=${version}`] = { "*": [`ts${version}/*`] };
  }
  return out;
}

export function parseHeaderOrFail(mainFileContent: string): Header {
  const header = parseHeader(mainFileContent, /*strict*/ false);
  if (isParseError(header)) {
    throw new Error(renderParseError(header));
  }
  return header;
}

export function validate(mainFileContent: string): ParseError | undefined {
  const h = parseHeader(mainFileContent, /*strict*/ true);
  return isParseError(h) ? h : undefined;
}

export function renderExpected(expected: readonly string[]): string {
  return expected.length === 1 ? expected[0] : `one of\n\t${expected.join("\n\t")}`;
}

function renderParseError({ line, column, expected }: ParseError): string {
  return `At ${line}:${column} : Expected ${renderExpected(expected)}`;
}

function isParseError(x: {}): x is ParseError {
  // tslint:disable-next-line strict-type-predicates
  return (x as ParseError).expected !== undefined;
}

/** @param strict If true, we allow fewer things to be parsed. Turned on by linting. */
function parseHeader(text: string, strict: boolean): Header | ParseError {
  const res = headerParser(strict).parse(text);
  return res.status
    ? res.value
    : { index: res.index.offset, line: res.index.line, column: res.index.column, expected: res.expected };
}

function headerParser(strict: boolean): pm.Parser<Header> {
  return pm.seqMap(
    pm.regex(/\/\/ Type definitions for (non-npm package )?/),
    parseLabel(strict),
    pm.string("// Project: "),
    projectParser,
    pm.regexp(/\r?\n\/\/ Definitions by: /),
    contributorsParser(strict),
    definitionsParser,
    typeScriptVersionParser,
    pm.all, // Don't care about the rest of the file
    // tslint:disable-next-line:variable-name
    (str, label, _project, projects, _defsBy, contributors, _definitions, typeScriptVersion) => ({
      libraryName: label.name,
      libraryMajorVersion: label.major,
      libraryMinorVersion: label.minor,
      nonNpm: str.endsWith("non-npm package "),
      projects,
      contributors,
      typeScriptVersion
    })
  );
}

interface Label {
  readonly name: string;
  readonly major: number;
  readonly minor: number;
}

/*
Allow any of the following:

// Project: https://foo.com
//          https://bar.com

// Project: https://foo.com,
//          https://bar.com

// Project: https://foo.com, https://bar.com

Use `\s\s+` to ensure at least 2 spaces, to  disambiguate from the next line being `// Definitions by:`.
*/
const separator: pm.Parser<string> = pm.regexp(/(, )|(,?\r?\n\/\/\s\s+)/);

const projectParser: pm.Parser<readonly string[]> = pm.sepBy1(pm.regexp(/[^,\r\n]+/), separator);

function contributorsParser(strict: boolean): pm.Parser<readonly Author[]> {
  const contributor: pm.Parser<Author> = strict
    ? pm.seqMap(
        pm.regexp(/([^<]+) /, 1),
        pm.regexp(/\<https\:\/\/github\.com\/([a-zA-Z\d\-]+)\/?\>/, 1),
        (name, githubUsername) => ({ name, url: `https://github.com/${githubUsername}`, githubUsername })
      )
    : // In non-strict mode, allows arbitrary URL, and trailing whitespace.
      pm.seqMap(pm.regexp(/([^<]+) /, 1), pm.regexp(/<([^>]+)> */, 1), (name, url) => {
        const rgx = /^https\:\/\/github.com\/([a-zA-Z\d\-]+)\/?$/;
        const match = rgx.exec(url);
        const githubUsername = match === null ? undefined : match[1];
        // tslint:disable-next-line no-null-keyword
        return { name, url: githubUsername ? `https://github.com/${githubUsername}` : url, githubUsername };
      });
  return pm.sepBy1(contributor, separator);
}

const definitionsParser = pm.regexp(/\r?\n\/\/ Definitions: [^\r\n]+/);

function parseLabel(strict: boolean): pm.Parser<Label> {
  return pm.Parser((input, index) => {
    // Take all until the first newline.
    const endIndex = regexpIndexOf(input, /\r|\n/, index);
    if (endIndex === -1) {
      return fail("EOF");
    }
    // Index past the end of the newline.
    const end = input[endIndex] === "\r" ? endIndex + 2 : endIndex + 1;
    const tilNewline = input.slice(index, endIndex);

    // Parse in reverse. Once we've stripped off the version, the rest is the libary name.
    const reversed = reverse(tilNewline);

    // Last digit is allowed to be "x", which acts like "0"
    const rgx = /((\d+|x)\.(\d+)(\.\d+)?(v)? )?(.+)/;
    const match = rgx.exec(reversed);
    if (match === null) {
      // tslint:disable-line no-null-keyword
      return fail();
    }
    const [, version, a, b, c, v, nameReverse] = match;

    let majorReverse: string;
    let minorReverse: string;
    if (version !== undefined) {
      // tslint:disable-line strict-type-predicates
      if (c !== undefined) {
        // tslint:disable-line strict-type-predicates
        // There is a patch version
        majorReverse = c;
        minorReverse = b;
        if (strict) {
          return fail("patch version not allowed");
        }
      } else {
        majorReverse = b;
        minorReverse = a;
      }
      if (v !== undefined && strict) {
        // tslint:disable-line strict-type-predicates
        return fail("'v' not allowed");
      }
    } else {
      if (strict) {
        return fail("Needs MAJOR.MINOR");
      }
      majorReverse = "0";
      minorReverse = "0";
    }

    const [name, major, minor] = [reverse(nameReverse), reverse(majorReverse), reverse(minorReverse)];
    return pm.makeSuccess<Label>(end, {
      name,
      major: intOfString(major),
      minor: minor === "x" ? 0 : intOfString(minor)
    });

    function fail(msg?: string): pm.Reply<Label> {
      let expected = "foo MAJOR.MINOR";
      if (msg !== undefined) {
        expected += ` (${msg})`;
      }
      return pm.makeFailure(index, expected);
    }
  });
}

const typeScriptVersionLineParser: pm.Parser<AllTypeScriptVersion> = pm
  .regexp(/\/\/ (?:Minimum )?TypeScript Version: (\d.(\d))/, 1)
  .chain<TypeScriptVersion>(v =>
    TypeScriptVersion.all.includes(v as TypeScriptVersion)
      ? pm.succeed(v as TypeScriptVersion)
      : pm.fail(`TypeScript ${v} is not yet supported.`)
  );

const typeScriptVersionParser: pm.Parser<AllTypeScriptVersion> = pm
  .regexp(/\r?\n/)
  .then(typeScriptVersionLineParser)
  .fallback<TypeScriptVersion>(TypeScriptVersion.shipped[0]);

export function parseTypeScriptVersionLine(line: string): AllTypeScriptVersion {
  const result = typeScriptVersionLineParser.parse(line);
  if (!result.status) {
    throw new Error(`Could not parse version: line is '${line}'`);
  }
  return result.value;
}

function reverse(s: string): string {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) {
    out += s[i];
  }
  return out;
}

function regexpIndexOf(s: string, rgx: RegExp, start: number): number {
  const index = s.slice(start).search(rgx);
  return index === -1 ? index : index + start;
}

declare module "parsimmon" {
  // tslint:disable-next-line no-unnecessary-qualifier
  type Pr<T> = pm.Parser<T>; // https://github.com/Microsoft/TypeScript/issues/14121
  export function seqMap<T, U, V, W, X, Y, Z, A, B, C>(
    p1: Pr<T>,
    p2: Pr<U>,
    p3: Pr<V>,
    p4: Pr<W>,
    p5: Pr<X>,
    p6: Pr<Y>,
    p7: Pr<Z>,
    p8: Pr<A>,
    p9: Pr<B>,
    cb: (a1: T, a2: U, a3: V, a4: W, a5: X, a6: Y, a7: Z, a8: A, a9: B) => C
  ): Pr<C>;
}

function intOfString(str: string): number {
  const n = Number.parseInt(str, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Error in parseInt(${JSON.stringify(str)})`);
  }
  return n;
}
