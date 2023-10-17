import { TSESTree } from "@typescript-eslint/utils";
import { commentsMatching, createRule } from "../util";

type MessageId = "referencePathPackage" | "referencePathTest" | "referencePathOldVersion";
const rule = createRule({
  name: "no-bad-reference",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: `Forbids <reference path="./vNN"/> in all files, <reference path="../etc"/> in declaration files, and all <reference path> in test files.`,
      recommended: "error",
    },
    messages: {
      referencePathPackage:
        "Don't use <reference path> to reference another package. Use an import or <reference types> instead.",
      referencePathTest:
        "Don't use <reference path> in test files. Use <reference types> or include the file in 'tsconfig.json'.",
      referencePathOldVersion: "Don't use <reference path> to reference an old version of the current package.",
    },
    schema: [],
  },
  create(context) {
    const isDeclarationFile = context.getFilename().endsWith(".d.ts");
    commentsMatching(context.getSourceCode(), /<reference\s+path\s*=\s*"(.+)"\s*\/>/, (ref, comment) => {
      if (ref.match(/^\.\/v\d+(?:\.\d+)?(?:\/.*)?$/)) {
        report(comment, "referencePathOldVersion");
      }
      if (isDeclarationFile) {
        if (ref.startsWith("..")) {
          report(comment, "referencePathPackage");
        }
      } else {
        report(comment, "referencePathTest");
      }
    });

    return {};

    function report(comment: TSESTree.Comment, messageId: MessageId) {
      context.report({
        loc: {
          end: {
            column: comment.value.lastIndexOf(`"`),
            line: comment.loc.end.line,
          },
          start: {
            column: comment.value.indexOf(`"`) + 1,
            line: comment.loc.start.line,
          },
        },
        messageId,
      });
    }
  },
});

export = rule;
