import { rules } from "../rules";
import { Linter } from "eslint";

export const all: Linter.BaseConfig = {
  plugins: ["@definitelytyped", "@typescript-eslint", "jsdoc"],
  settings: {
    jsdoc: {
      tagNamePreference: {
        argument: "argument",
        exception: "exception",
        function: "function",
        method: "method",
        param: "param",
        return: "return",
        returns: "returns",
      },
    },
  },
  rules: {
    "jsdoc/check-tag-names": [
      "error",
      {
        // TODO: Some (but not all) of these tags should likely be removed from this list.
        // Additionally, some may need to be contributed to eslint-plugin-jsdoc.
        definedTags: [
          "addVersion",
          "also",
          "api",
          "author",
          "beta",
          "brief",
          "category",
          "cfg",
          "chainable",
          "check",
          "checkReturnValue",
          "classDescription",
          "condparamprivilege",
          "constraint",
          "credits",
          "declaration",
          "defApiFeature",
          "defaultValue",
          "detail",
          "end",
          "eventproperty",
          "experimental",
          "export",
          "expose",
          "extendscript",
          "factory",
          "field",
          "final",
          "fixme",
          "fluent",
          "for",
          "governance",
          "header",
          "hidden-property",
          "hidden",
          "id",
          "jsx",
          "jsxImportSource",
          "label",
          "language",
          "legacy",
          "link",
          "listen",
          "locus",
          "methodOf",
          "minVersion",
          "ngdoc",
          "nonstandard",
          "note",
          "npm",
          "observable",
          "option",
          "optionobject",
          "options",
          "packageDocumentation",
          "param",
          "parent",
          "platform",
          "plugin",
          "preserve",
          "privateRemarks",
          "privilegeLevel",
          "privilegeName",
          "proposed",
          "range",
          "readOnly",
          "related",
          "remark",
          "remarks",
          "required",
          "requires",
          "restriction",
          "returnType",
          "section",
          "see",
          "since",
          "const",
          "singleton",
          "source",
          "struct",
          "suppress",
          "targetfolder",
          "enum",
          "title",
          "record",
          "title",
          "TODO",
          "trigger",
          "triggers",
          "typeparam",
          "typeParam",
          "unsupported",
          "url",
          "usage",
          "warn",
          "warning",
          "version",
        ],
        typed: true,
      },
    ],
  },

  overrides: [
    {
      files: ["*.cts", "*.mts", "*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: true,
        warnOnUnsupportedTypeScriptVersion: false,
      },
      rules: {
        ...Object.fromEntries(
          Object.keys(rules)
            // npm-naming is only enabled within dtslint.
            // Leave it out of the preset so editors / he tests don't hit the network.
            .filter((name) => name !== "npm-naming")
            .map((name) => [`@definitelytyped/${name}`, "error"]),
        ),
        "unicode-bom": ["error", "never"],
        "@typescript-eslint/ban-ts-comment": [
          "error",
          {
            "ts-expect-error": false, // Used in tests.
            "ts-ignore": "allow-with-description",
            "ts-nocheck": true,
            "ts-check": false,
          },
        ],
        "@typescript-eslint/adjacent-overload-signatures": "error",
        "@typescript-eslint/ban-types": [
          "error",
          {
            types: { "{}": false },
            extendDefaults: true,
          },
        ],
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/triple-slash-reference": ["error", { types: "prefer-import", path: "always" }],
        "@typescript-eslint/no-empty-interface": "error",
        "no-duplicate-imports": "error",
        "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
        "@typescript-eslint/naming-convention": [
          "error",
          {
            selector: "interface",
            format: [],
            custom: {
              regex: "^I[A-Z]",
              match: false,
            },
          },
        ],
        "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
        "@typescript-eslint/no-misused-new": "error",
        "@typescript-eslint/consistent-type-definitions": "error",
        "@typescript-eslint/no-invalid-void-type": [
          "error",
          { allowAsThisParameter: true, allowInGenericTypeArguments: true },
        ],
      },
    },
    {
      files: ["*.d.cts", "*.d.mts", "*.d.ts", "*.d.*.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
              // Ignore: (solely underscores | starting with exactly one underscore)
              "argsIgnorePattern": "^(_+$|_[^_])",
              "varsIgnorePattern": "^(_+$|_[^_])"
          }
      ],
      },
    },
  ],
};
