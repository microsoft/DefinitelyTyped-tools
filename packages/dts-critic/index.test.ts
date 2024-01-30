/// <reference types="jest" />
import { findDtsName, dtToNpmName, parseExportErrorKind, checkSource, ErrorKind, ExportErrorKind } from "./index";

function suite(description: string, tests: { [s: string]: () => void }) {
  describe(description, () => {
    for (const k in tests) {
      test(k, tests[k], 10 * 1000);
    }
  });
}

suite("findDtsName", {
  absolutePath() {
    expect(findDtsName("~/dt/types/jquery/index.d.ts")).toBe("jquery");
  },
  relativePath() {
    expect(findDtsName("jquery/index.d.ts")).toBe("jquery");
  },
  currentDirectory() {
    expect(findDtsName("index.d.ts")).toBe("DefinitelyTyped-tools");
  },
  relativeCurrentDirectory() {
    expect(findDtsName("./index.d.ts")).toBe("DefinitelyTyped-tools");
  },
  emptyDirectory() {
    expect(findDtsName("")).toBe("DefinitelyTyped-tools");
  },
});
suite("dtToNpmName", {
  nonScoped() {
    expect(dtToNpmName("content-type")).toBe("content-type");
  },
  scoped() {
    expect(dtToNpmName("babel__core")).toBe("@babel/core");
  },
});
suite("parseExportErrorKind", {
  existent() {
    expect(parseExportErrorKind("NoDefaultExport")).toBe(ErrorKind.NoDefaultExport);
  },
  existentDifferentCase() {
    expect(parseExportErrorKind("JspropertyNotinDTS")).toBe(ErrorKind.JsPropertyNotInDts);
  },
  nonexistent() {
    expect(parseExportErrorKind("FakeError")).toBe(undefined);
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
  return __dirname + "/testsource/" + filename;
}

suite("checkSource", {
  noErrors() {
    expect(checkSource("noErrors", testsource("noErrors.d.ts"), testsource("noErrors.js"), allErrors, false)).toEqual(
      [],
    );
  },
  missingJsProperty() {
    expect(
      checkSource(
        "missingJsProperty",
        testsource("missingJsProperty.d.ts"),
        testsource("missingJsProperty.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.JsPropertyNotInDts,
          message: `The declaration doesn't match the JavaScript module 'missingJsProperty'. Reason:
The JavaScript module exports a property named 'foo', which is missing from the declaration module.`,
        },
      ]),
    );
  },
  noMissingWebpackProperty() {
    expect(
      checkSource(
        "missingJsProperty",
        testsource("webpackPropertyNames.d.ts"),
        testsource("webpackPropertyNames.js"),
        allErrors,
        false,
      ),
    ).toHaveLength(0);
  },
  missingDtsProperty() {
    expect(
      checkSource(
        "missingDtsProperty",
        testsource("missingDtsProperty.d.ts"),
        testsource("missingDtsProperty.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.DtsPropertyNotInJs,
          message: `The declaration doesn't match the JavaScript module 'missingDtsProperty'. Reason:
The declaration module exports a property named 'foo', which is missing from the JavaScript module.`,
          position: {
            start: 65,
            length: 11,
          },
        },
      ]),
    );
  },
  missingDefaultExport() {
    expect(
      checkSource(
        "missingDefault",
        testsource("missingDefault.d.ts"),
        testsource("missingDefault.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.NoDefaultExport,
          message: `The declaration doesn't match the JavaScript module 'missingDefault'. Reason:
The declaration specifies 'export default' but the JavaScript source does not mention 'default' anywhere.

The most common way to resolve this error is to use 'export =' syntax instead of 'export default'.
To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
          position: {
            start: 0,
            length: 33,
          },
        },
      ]),
    );
  },
  missingJsSignatureExportEquals() {
    expect(
      checkSource(
        "missingJsSignatureExportEquals",
        testsource("missingJsSignatureExportEquals.d.ts"),
        testsource("missingJsSignatureExportEquals.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.JsSignatureNotInDts,
          message: `The declaration doesn't match the JavaScript module 'missingJsSignatureExportEquals'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.`,
        },
      ]),
    );
  },
  missingJsSignatureNoExportEquals() {
    expect(
      checkSource(
        "missingJsSignatureNoExportEquals",
        testsource("missingJsSignatureNoExportEquals.d.ts"),
        testsource("missingJsSignatureNoExportEquals.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.JsSignatureNotInDts,
          message: `The declaration doesn't match the JavaScript module 'missingJsSignatureNoExportEquals'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.

The most common way to resolve this error is to use 'export =' syntax.
To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
        },
      ]),
    );
  },
  missingDtsSignature() {
    expect(
      checkSource(
        "missingDtsSignature",
        testsource("missingDtsSignature.d.ts"),
        testsource("missingDtsSignature.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.DtsSignatureNotInJs,
          message: `The declaration doesn't match the JavaScript module 'missingDtsSignature'. Reason:
The declaration module can be called or constructed, but the JavaScript module cannot.`,
        },
      ]),
    );
  },
  missingExportEquals() {
    expect(
      checkSource(
        "missingExportEquals",
        testsource("missingExportEquals.d.ts"),
        testsource("missingExportEquals.js"),
        allErrors,
        false,
      ),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: ErrorKind.NeedsExportEquals,
          message: `The declaration doesn't match the JavaScript module 'missingExportEquals'. Reason:
The declaration should use 'export =' syntax because the JavaScript source uses 'module.exports =' syntax and 'module.exports' can be called or constructed.

To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
        },
      ]),
    );
  },
});
