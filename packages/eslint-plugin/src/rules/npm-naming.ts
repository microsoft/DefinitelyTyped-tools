import {
  CheckOptions as CriticOptions,
  dtsCritic as critic,
  ErrorKind,
  ExportErrorKind,
  Mode,
  parseExportErrorKind,
} from "@definitelytyped/dts-critic";

import { createRule, isMainFile } from "../util";
import { CodeRawOptionError, NpmNamingOptions } from "./npm-naming/types";

function parseEnabledErrors(errors: CodeRawOptionError[]): [ExportErrorKind, boolean][] {
  const enabledChecks: [ExportErrorKind, boolean][] = [];
  for (const tuple of errors) {
    const error = parseExportErrorKind(tuple[0]);
    if (error) {
      enabledChecks.push([error, tuple[1]]);
    }
  }
  return enabledChecks;
}

function parseRawOptions(rawOptions: NpmNamingOptions): CriticOptions {
  switch (rawOptions.mode) {
    case Mode.Code:
      return { ...rawOptions, errors: new Map(parseEnabledErrors(rawOptions.errors)) };
    case Mode.NameOnly:
      return rawOptions;
  }
}

const enabledSuggestions = [ErrorKind.JsPropertyNotInDts, ErrorKind.JsSignatureNotInDts] as const;

function toOptionsWithSuggestions(options: CriticOptions): CriticOptions {
  if (options.mode === Mode.NameOnly) {
    return options;
  }

  const optionsWithSuggestions = { mode: options.mode, errors: new Map(options.errors) };

  for (const err of enabledSuggestions) {
    optionsWithSuggestions.errors.set(err, true);
  }

  return optionsWithSuggestions;
}

function eslintDisableOption(error: ErrorKind): string {
  switch (error) {
    case ErrorKind.NoMatchingNpmPackage:
    case ErrorKind.NoMatchingNpmVersion:
    case ErrorKind.NonNpmHasMatchingPackage:
      return `"off"`;
    case ErrorKind.NoDefaultExport:
    case ErrorKind.NeedsExportEquals:
    case ErrorKind.JsSignatureNotInDts:
    case ErrorKind.JsPropertyNotInDts:
    case ErrorKind.DtsSignatureNotInJs:
    case ErrorKind.DtsPropertyNotInJs:
      return JSON.stringify(["error", { mode: Mode.Code, errors: [[error, false]] }], null, 2);
  }
}

const rule = createRule<[NpmNamingOptions], "error">({
  name: "npm-naming",
  defaultOptions: [
    {
      mode: Mode.NameOnly,
    },
  ],
  meta: {
    type: "problem",
    docs: {
      description: "Ensure that package name and DefinitelyTyped header match npm package info.",
    },
    messages: {
      error: `{{ error }}
If you won't fix this error now or you think this error is wrong,
you can disable this check by adding the following options to your project's tslint.json file under "rules":

    "npm-naming": {{ option }}`,
    },
    schema: [
      {
        oneOf: [
          {
            additionalProperties: false,
            properties: {
              mode: {
                type: "string",
                enum: [Mode.NameOnly],
              },
            },
            type: "object",
          },
          {
            additionalProperties: false,
            type: "object",
            properties: {
              mode: {
                type: "string",
                enum: [Mode.Code],
              },
              errors: {
                type: "array",
                items: {
                  type: "array",
                  items: [
                    {
                      description: "Name of the check.",
                      type: "string",
                      enum: [ErrorKind.NeedsExportEquals, ErrorKind.NoDefaultExport],
                    },
                    {
                      description: "Whether the check is enabled or disabled.",
                      type: "boolean",
                    },
                  ],
                  minItems: 2,
                  maxItems: 2,
                },
                default: [],
              },
            },
          },
        ],
      },
    ],
  },
  create(context, [rawOptions]) {
    if (!isMainFile(context.filename, /*allowNested*/ false)) {
      return {};
    }

    const options = parseRawOptions(rawOptions);
    const optionsWithSuggestions = toOptionsWithSuggestions(options);
    const errors = critic(context.filename, /* sourcePath */ undefined, optionsWithSuggestions);

    for (const error of errors) {
      switch (error.kind) {
        case ErrorKind.NoMatchingNpmPackage:
        case ErrorKind.NoMatchingNpmVersion:
        case ErrorKind.NonNpmHasMatchingPackage:
        case ErrorKind.DtsPropertyNotInJs:
        case ErrorKind.DtsSignatureNotInJs:
        case ErrorKind.JsPropertyNotInDts:
        case ErrorKind.JsSignatureNotInDts:
        case ErrorKind.NeedsExportEquals:
        case ErrorKind.NoDefaultExport:
          context.report({
            data: {
              error: error.message,
              option: eslintDisableOption(error.kind),
            },
            loc: error.position
              ? {
                  start: context.sourceCode.getLocFromIndex(error.position.start),
                  end: context.sourceCode.getLocFromIndex(error.position.start + error.position.length),
                }
              : {
                  end: {
                    line: 2,
                    column: 0,
                  },
                  start: {
                    line: 1,
                    column: 0,
                  },
                },
            messageId: "error",
          });
          break;
      }
    }

    return {};
  },
});

export = rule;
