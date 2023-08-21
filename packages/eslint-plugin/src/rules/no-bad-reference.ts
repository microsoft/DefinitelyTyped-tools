import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../util";

type MessageId = "referencePathPackage" | "referencePathTest";

const rule = createRule({
  name: "no-bad-reference",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: `Forbids <reference path="../etc"/> in any file, and forbid <reference path> in test files.`,
      recommended: "error",
    },
    messages: {
      referencePathPackage:
        "Don't use <reference path> to reference another package. Use an import or <reference types> instead.",
      referencePathTest:
        "Don't use <reference path> in test files. Use <reference types> or include the file in 'tsconfig.json'.",
    },
    schema: [],
  },
  create(context) {
    const { comments } = context.getSourceCode().ast;
    const isDeclarationFile = context.getFilename().endsWith(".d.ts");

    for (const comment of comments) {
      const referenceMatch = comment.value.match(/<reference\s+path\s*=\s*"(.+)"\s*\/>/)?.[1];
      if (!referenceMatch) {
        continue;
      }

      if (isDeclarationFile) {
        if (referenceMatch.startsWith("..")) {
          report(comment, "referencePathPackage");
        }
      } else {
        report(comment, "referencePathTest");
      }
    }

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
