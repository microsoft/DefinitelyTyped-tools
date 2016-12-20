import pm = require("parsimmon");
import { intOfString } from "../util/util";
import { TypeScriptVersion } from "./common";

/*
Example:
// Type definitions for foo 1.2
// Project: https://github.com/foo/foo, https://foo.com
// Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.1
*/

export interface Header {
	libraryName: string;
	libraryMajorVersion: number;
	libraryMinorVersion: number;
	typeScriptVersion: TypeScriptVersion;
	projects: string[];
	authors: Author[];
}

export interface Author { name: string; url: string; }

interface ParseError {
	index: number;
	line: number;
	column: number;
	expected: string[];
}

export function parseHeaderOrFail(mainFileContent: string, name: string): Header {
	const header = parseHeader(mainFileContent, /*strict*/false);
	if (isParseError(header)) {
		throw new Error(`In ${name}: ${renderParseError(header)}`);
	}
	return header as Header;
}

export function validate(mainFileContent: string): ParseError | undefined {
	const h = parseHeader(mainFileContent, /*strict*/true);
	return isParseError(h) ? h : undefined;
}

export function renderExpected(expected: string[]): string {
	return expected.length === 1 ? expected[0] : `one of\n\t${expected.join("\n\t")}`;
}

function renderParseError({ line, column, expected }: ParseError): string {
	return `At ${line}:${column} : Expected ${renderExpected(expected)}`;
}

function isParseError(x: {}): x is ParseError {
	return !!(x as ParseError).expected;
}

/** @param strict If true, we allow fewer things to be parsed. Turned on by linting. */
function parseHeader(text: string, strict: boolean): Header | ParseError {
	const res = headerParser(strict).parse(text);

	if (res.status) {
		const { label: { name, major, minor }, projects, authors, typeScriptVersion } = res.value!;
		return { libraryName: name, libraryMajorVersion: major, libraryMinorVersion: minor, projects, authors, typeScriptVersion };
	}
	// parsimmon types are wrong: expected is actually string[]
	return { index: res.index!.offset, line: res.index!.line, column: res.index!.column, expected: res.expected as any as string[] };
}

function headerParser(strict: boolean): pm.Parser<{ label: Label, projects: string[], authors: Author[], typeScriptVersion: TypeScriptVersion }> {
	return pm.seqMap(
		pm.string("// Type definitions for "),
		parseLabel(strict),
		pm.string("// Project: "),
		projectParser,
		pm.regexp(/\r?\n\/\/ Definitions by: /),
		authorsParser(strict),
		parseDefinitions,
		parseTypeScriptVersion,
		pm.all, // Don't care about the rest of the file
		// tslint:disable-next-line:variable-name
		(_str, label, _project, projects, _defsBy, authors, _definitions, typeScriptVersion) => ({ label, projects, authors, typeScriptVersion }));
}

interface Label { name: string; major: number; minor: number; }

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

const projectParser: pm.Parser<string[]> = pm.sepBy1(pm.regexp(/[^,\r\n]+/), separator);

function authorsParser(strict: boolean): pm.Parser<Author[]> {
	const author = pm.seqMap(pm.regexp(/([^<]+) /, 1), pm.regexp(/<([^>]+)>/, 1), (name, url) => ({ name, url }));
	const authors = pm.sepBy1(author, separator);
	if (!strict) {
		// Allow trailing whitespace.
		return pm.seqMap(authors, pm.regexp(/ */), a => a);
	}
	return authors;
};

// TODO: Should we do something with the URL?
const parseDefinitions = pm.regexp(/\r?\n\/\/ Definitions: [^\r\n]+/);

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
		if (!match) {
			return fail();
		}
		const [, version, a, b, c, v, nameReverse] = match;

		let majorReverse: string, minorReverse: string;
		if (version) {
			if (c) {
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
			if (v && strict) {
				return fail("'v' not allowed");
			}
		}
		else {
			if (strict) {
				return fail("Needs MAJOR.MINOR");
			}
			majorReverse = "0"; minorReverse = "0";
		}

		const [name, major, minor] = [reverse(nameReverse), reverse(majorReverse), reverse(minorReverse)];
		return pm.makeSuccess<Label>(end, { name, major: intOfString(major), minor: minor === "x" ? 0 : intOfString(minor) });

		function fail(msg?: string): pm.Result<Label> {
			let expected = "foo MAJOR.MINOR";
			if (msg) {
				expected += ` (${msg})`;
			}
			return pm.makeFailure(index, expected);
		}
	});
}

const parseTypeScriptVersion: pm.Parser<TypeScriptVersion> =
	pm.regexp(/\r?\n\/\/ TypeScript Version: 2.1/)
		.result<TypeScriptVersion>("2.1")
		.fallback<TypeScriptVersion>("2.0");

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
	export function seqMap<T, U, V, W, X, Y, Z, A, B, C>(
		p1: Parser<T>, p2: Parser<U>, p3: Parser<V>, p4: Parser<W>, p5: Parser<X>, p6: Parser<Y>, p7: Parser<Z>, p8: Parser<A>, p9: Parser<B>,
		cb: (a1: T, a2: U, a3: V, a4: W, a5: X, a6: Y, a7: Z, a8: A, a9: B) => C): Parser<C>;
}
