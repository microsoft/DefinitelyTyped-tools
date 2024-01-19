import {
  CheckOptions as CriticOptions,
  dtsCritic as critic,
  ErrorKind,
  ExportErrorKind,
  parseExportErrorKind,
  CriticError,
} from "@definitelytyped/dts-critic";

import { addSuggestion } from "../suggestions";
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
  return { errors: new Map(parseEnabledErrors(rawOptions.errors)) };
}

const enabledSuggestions: ExportErrorKind[] = [ErrorKind.JsPropertyNotInDts, ErrorKind.JsSignatureNotInDts];

function toOptionsWithSuggestions(options: CriticOptions): CriticOptions {
  const optionsWithSuggestions = { errors: new Map(options.errors) };

  for (const err of enabledSuggestions) {
    optionsWithSuggestions.errors.set(err, true);
  }

  return optionsWithSuggestions;
}

function eslintDisableOption(error: ErrorKind): string {
  switch (error) {
    case ErrorKind.NoDefaultExport:
    case ErrorKind.NeedsExportEquals:
    case ErrorKind.JsSignatureNotInDts:
    case ErrorKind.JsPropertyNotInDts:
    case ErrorKind.DtsSignatureNotInJs:
    case ErrorKind.DtsPropertyNotInJs:
      return JSON.stringify(["error", { errors: [[error, false]] }]);
  }
}

const rule = createRule<[NpmNamingOptions], "error">({
  name: "npm-naming",
  defaultOptions: [
    {
      implementationPackageDirectory: "",
      errors: [[ErrorKind.NeedsExportEquals, true], [ErrorKind.NoDefaultExport, true]],
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
you can disable this check by adding the following options to your project's .eslintrc.json file under "rules":

    "@definitelytyped/npm-naming": {{ option }}`,
    },
    schema: [
      {
        oneOf: [
          {
            additionalProperties: false,
            type: "object",
            properties: {
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
              },
              implementationPackageDirectory: {
                type: "string",
                required: true,
              } 
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
    const diagnostics = critic(context.filename, rawOptions.implementationPackageDirectory, optionsWithSuggestions);
    const errors = filterErrors(diagnostics);

    for (const error of errors) {
      switch (error.kind) {
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

    function filterErrors(diagnostics: CriticError[]): CriticError[] {
      const errors: CriticError[] = [];

      diagnostics.forEach((diagnostic) => {
        if (isSuggestion(diagnostic)) {
          addSuggestion(
            context.filename,
            "npm-naming",
            diagnostic.message,
            diagnostic.position?.start,
            diagnostic.position?.length,
          );
        } else {
          errors.push(diagnostic);
        }
      });

      return errors;
    }

    function isSuggestion(diagnostic: CriticError): boolean {
      return (
        enabledSuggestions.includes(diagnostic.kind as ExportErrorKind) &&
        !(options.errors as Map<ErrorKind, boolean>).get(diagnostic.kind)
      );
    }
  },
});

export = rule;
