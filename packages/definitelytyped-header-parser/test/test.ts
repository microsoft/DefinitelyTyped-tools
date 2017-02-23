import assert = require("assert");
import { parseHeaderOrFail, parseTypeScriptVersionLine } from "..";

describe("parse", () => {
	it("works", () => {
		const src = dedent`
			// Type definitions for foo 1.2
			// Project: https://github.com/foo/foo, https://foo.com
			// Definitions by: My Self <https://github.com/me>, Some Other Guy <https://github.com/otherguy>
			// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
			// TypeScript Version: 2.2

			...file content...`;
		assert.deepStrictEqual(parseHeaderOrFail(src), {
			libraryName: "foo",
			libraryMajorVersion: 1,
			libraryMinorVersion: 2,
			typeScriptVersion: "2.2",
			projects: ["https://github.com/foo/foo", "https://foo.com"],
			contributors: [
				{ name: "My Self", url: "https://github.com/me" },
				{ name: "Some Other Guy", url: "https://github.com/otherguy" }
			]
		});
	});

	it("works with spacing", () => {
		const src = dedent`
			// Type definitions for foo 1.2
			// Project: https://github.com/foo/foo,
			//          https://foo.com
			// Definitions by: My Self <https://github.com/me>,
			//                 Some Other Guy <https://github.com/otherguy>
			// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

			...file content...`;

		assert.deepStrictEqual(parseHeaderOrFail(src), {
			libraryName: "foo",
			libraryMajorVersion: 1,
			libraryMinorVersion: 2,
			typeScriptVersion: "2.0",
			projects: ["https://github.com/foo/foo", "https://foo.com"],
			contributors: [
				{ name: "My Self", url: "https://github.com/me" },
				{ name: "Some Other Guy", url: "https://github.com/otherguy" }
			]
		});
	});
});

describe("parseTypeScriptVersionLine", () => {
	it("works", () => {
		const src = "// TypeScript Version: 2.1";
		assert.equal(parseTypeScriptVersionLine(src), "2.1");

		const wrong = "// TypeScript Version: 3.14";
		assert.throws(() => parseTypeScriptVersionLine(wrong));
	});
});

function dedent(strings: TemplateStringsArray) {
	assert.equal(strings.length, 1);
	const x = strings[0].trim();
	return x.replace(/\n\t\t\t/g, "\n");
}
