import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import path from "path";
import { findDtsName, dtToNpmName, parseExportErrorKind, checkSource, ErrorKind, ExportErrorKind } from "./index";

function suite(description: string, tests: { [s: string]: () => void }) {
  describe(description, () => {
    for (const k in tests) {
      test(k, { timeout: 10 * 1000 }, tests[k]);
    }
  });
}

suite("findDtsName", {
  absolutePath() {
    assert.equal(findDtsName("~/dt/types/jquery/index.d.ts"), "jquery");
  },
  relativePath() {
    assert.equal(findDtsName("jquery/index.d.ts"), "jquery");
  },
  currentDirectory() {
    assert.equal(findDtsName("index.d.ts"), path.basename(process.cwd()));
  },
  relativeCurrentDirectory() {
    assert.equal(findDtsName("./index.d.ts"), path.basename(process.cwd()));
  },
  emptyDirectory() {
    assert.equal(findDtsName(""), path.basename(process.cwd()));
  },
});
suite("dtToNpmName", {
  nonScoped() {
    assert.equal(dtToNpmName("content-type"), "content-type");
  },
  scoped() {
    assert.equal(dtToNpmName("babel__core"), "@babel/core");
  },
});
suite("parseExportErrorKind", {
  existent() {
    assert.equal(parseExportErrorKind("NoDefaultExport"), ErrorKind.NoDefaultExport);
  },
  existentDifferentCase() {
    assert.equal(parseExportErrorKind("JspropertyNotinDTS"), ErrorKind.JsPropertyNotInDts);
  },
  nonexistent() {
    assert.equal(parseExportErrorKind("FakeError"), undefined);
  },
});

const allErrors: Map<ExportErrorKind, true> = new Map([
  [ErrorKind.NeedsExportEquals, true],
  [ErrorKind.NoDefaultExport, true],
  [ErrorKind.JsSignatureNotInDts, true],
  [ErrorKind.DtsSignatureNotInJs, true],
  [ErrorKind.DtsPropertyNotInJs, true],
  [ErrorKind.JsPropertyNotInDts, true],
]);

function testsource(filename: string) {
  return path.resolve("packages/dts-critic/testsource", filename);
}

suite("checkSource", {
  noErrors() {
    assert.deepEqual(
      checkSource("noErrors", testsource("noErrors.d.ts"), testsource("noErrors.js"), allErrors, false),
      [],
    );
  },
  missingJsProperty() {
    assert.ok(
      checkSource(
        "missingJsProperty",
        testsource("missingJsProperty.d.ts"),
        testsource("missingJsProperty.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.JsPropertyNotInDts,
          message: `The declaration doesn't match the JavaScript module 'missingJsProperty'. Reason:
The JavaScript module exports a property named 'foo', which is missing from the declaration module.`,
        }),
      ),
    );
  },
  noMissingWebpackProperty() {
    assert.equal(
      checkSource(
        "missingJsProperty",
        testsource("webpackPropertyNames.d.ts"),
        testsource("webpackPropertyNames.js"),
        allErrors,
        false,
      ).length,
      0,
    );
  },
  missingDtsProperty() {
    assert.ok(
      checkSource(
        "missingDtsProperty",
        testsource("missingDtsProperty.d.ts"),
        testsource("missingDtsProperty.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.DtsPropertyNotInJs,
          message: `The declaration doesn't match the JavaScript module 'missingDtsProperty'. Reason:
The declaration module exports a property named 'foo', which is missing from the JavaScript module.`,
          position: {
            start: 65,
            length: 11,
          },
        }),
      ),
    );
  },
  missingDefaultExport() {
    assert.ok(
      checkSource(
        "missingDefault",
        testsource("missingDefault.d.ts"),
        testsource("missingDefault.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.NoDefaultExport,
          message: `The declaration doesn't match the JavaScript module 'missingDefault'. Reason:
The declaration specifies 'export default' but the JavaScript source does not mention 'default' anywhere.

The most common way to resolve this error is to use 'export =' syntax instead of 'export default'.
To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
          position: {
            start: 0,
            length: 33,
          },
        }),
      ),
    );
  },
  missingJsSignatureExportEquals() {
    assert.ok(
      checkSource(
        "missingJsSignatureExportEquals",
        testsource("missingJsSignatureExportEquals.d.ts"),
        testsource("missingJsSignatureExportEquals.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.JsSignatureNotInDts,
          message: `The declaration doesn't match the JavaScript module 'missingJsSignatureExportEquals'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.`,
        }),
      ),
    );
  },
  missingJsSignatureNoExportEquals() {
    assert.ok(
      checkSource(
        "missingJsSignatureNoExportEquals",
        testsource("missingJsSignatureNoExportEquals.d.ts"),
        testsource("missingJsSignatureNoExportEquals.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.JsSignatureNotInDts,
          message: `The declaration doesn't match the JavaScript module 'missingJsSignatureNoExportEquals'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.

The most common way to resolve this error is to use 'export =' syntax.
To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
        }),
      ),
    );
  },
  missingDtsSignature() {
    assert.ok(
      checkSource(
        "missingDtsSignature",
        testsource("missingDtsSignature.d.ts"),
        testsource("missingDtsSignature.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.DtsSignatureNotInJs,
          message: `The declaration doesn't match the JavaScript module 'missingDtsSignature'. Reason:
The declaration module can be called or constructed, but the JavaScript module cannot.`,
        }),
      ),
    );
  },
  missingExportEquals() {
    assert.ok(
      checkSource(
        "missingExportEquals",
        testsource("missingExportEquals.d.ts"),
        testsource("missingExportEquals.js"),
        allErrors,
        false,
      ).some((error) =>
        isDeepStrictEqual(error, {
          kind: ErrorKind.NeedsExportEquals,
          message: `The declaration doesn't match the JavaScript module 'missingExportEquals'. Reason:
The declaration should use 'export =' syntax because the JavaScript source uses 'module.exports =' syntax and 'module.exports' can be called or constructed.

To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
        }),
      ),
    );
  },
});
