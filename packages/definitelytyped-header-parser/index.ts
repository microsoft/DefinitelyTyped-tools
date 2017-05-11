import pm = require("parsimmon");

/*
Example:
// Type definitions for foo 1.2
// Project: https://github.com/foo/foo, https://foo.com
// Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.1
*/

export type TypeScriptVersion = "2.0" | "2.1" | "2.2" | "2.3";
export namespace TypeScriptVersion {
	export const All: TypeScriptVersion[] = ["2.0", "2.1", "2.2", "2.3"];
	export const Lowest = "2.0";
	/** Latest version that may be specified in a `// TypeScript Version:` header. */
	export const Latest = "2.3";

	for (const v of All) {
		if (v > Latest) {
			throw new Error("'Latest' not properly set.");
		}
	}

	/** True if a package with the given typescript version should be published as prerelease. */
	export function isPrerelease(version: TypeScriptVersion): boolean {
		return version === Latest;
	}

	/** List of NPM tags that should be changed to point to the latest version. */
	export function tagsToUpdate(typeScriptVersion: TypeScriptVersion): string[]  {
		switch (typeScriptVersion) {
			case "2.0":
				// A 2.0-compatible package is assumed compatible with TypeScript 2.1
				// We want the "2.1" tag to always exist.
				return [tags.latest, tags.v2_0, tags.v2_1, tags.v2_2, tags.v2_3, tags.v2_4];
			case "2.1":
				return [tags.latest, tags.v2_1, tags.v2_2, tags.v2_3, tags.v2_4];
			case "2.2":
				return [tags.latest, tags.v2_2, tags.v2_3, tags.v2_4];
			case "2.3":
				return [tags.latest, tags.v2_3, tags.v2_4];
		}
	}

	namespace tags {
		export const latest = "latest";
		export const v2_0 = "ts2.0";
		export const v2_1 = "ts2.1";
		export const v2_2 = "ts2.2";
		export const v2_3 = "ts2.3";
		export const v2_4 = "ts2.4";
	}
}

export interface Header {
	libraryName: string;
	libraryMajorVersion: number;
	libraryMinorVersion: number;
	typeScriptVersion: TypeScriptVersion;
	projects: string[];
	contributors: Author[];
}

export interface Author { name: string; url: string; }

export interface ParseError {
	index: number;
	line: number;
	column: number;
	expected: string[];
}

export function parseHeaderOrFail(mainFileContent: string): Header {
	const header = parseHeader(mainFileContent, /*strict*/false);
	if (isParseError(header)) {
		throw new Error(renderParseError(header));
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
	return res.status
		? res.value
		: { index: res.index!.offset, line: res.index!.line, column: res.index!.column, expected: res.expected };
}

function headerParser(strict: boolean): pm.Parser<Header> {
	return pm.seqMap(
		pm.string("// Type definitions for "),
		parseLabel(strict),
		pm.string("// Project: "),
		projectParser,
		pm.regexp(/\r?\n\/\/ Definitions by: /),
		contributorsParser(strict),
		definitionsParser,
		typeScriptVersionParser,
		pm.all, // Don't care about the rest of the file
		// tslint:disable-next-line:variable-name
		(_str, label, _project, projects, _defsBy, contributors, _definitions, typeScriptVersion) => ({
			libraryName: label.name,
			libraryMajorVersion: label.major,
			libraryMinorVersion: label.minor,
			projects, contributors, typeScriptVersion
		}));
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

function contributorsParser(strict: boolean): pm.Parser<Author[]> {
	const contributor = pm.seqMap(pm.regexp(/([^<]+) /, 1), pm.regexp(/<([^>]+)>/, 1), (name, url) => ({ name, url }));
	const contributors = pm.sepBy1(contributor, separator);
	if (!strict) {
		// Allow trailing whitespace.
		return pm.seqMap(contributors, pm.regexp(/ */), a => a);
	}
	return contributors;
};

// TODO: Should we do something with the URL?
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
		if (!match) {
			return fail();
		}
		const [, version, a, b, c, v, nameReverse] = match;

		let majorReverse: string;
		let minorReverse: string;
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
		} else {
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

const typeScriptVersionLineParser: pm.Parser<TypeScriptVersion> =
	pm.regexp(/\/\/ TypeScript Version: 2.(\d)/, 1).chain<TypeScriptVersion>(d => {
		switch (d) {
			case "1":
				return pm.succeed<TypeScriptVersion>("2.1");
			case "2":
				return pm.succeed<TypeScriptVersion>("2.2");
			default:
				return pm.fail(`TypeScript 2.${d} is not yet supported.`);
		}
	});

const typeScriptVersionParser: pm.Parser<TypeScriptVersion> =
	pm.regexp(/\r?\n/)
		.then(typeScriptVersionLineParser)
		.fallback<TypeScriptVersion>("2.0");

export function parseTypeScriptVersionLine(line: string): TypeScriptVersion {
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
	type Pr<T> = pm.Parser<T>; // https://github.com/Microsoft/TypeScript/issues/14121
	export function seqMap<T, U, V, W, X, Y, Z, A, B, C>(
		p1: Pr<T>, p2: Pr<U>, p3: Pr<V>, p4: Pr<W>, p5: Pr<X>, p6: Pr<Y>, p7: Pr<Z>, p8: Pr<A>, p9: Pr<B>,
		cb: (a1: T, a2: U, a3: V, a4: W, a5: X, a6: Y, a7: Z, a8: A, a9: B) => C): Pr<C>;
}

function intOfString(str: string) {
	const n = Number.parseInt(str, 10);
	if (Number.isNaN(n)) {
		throw new Error(`Error in parseInt(${JSON.stringify(str)})`);
	}
	return n;
}
