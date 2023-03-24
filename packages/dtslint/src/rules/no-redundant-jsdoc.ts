import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import assert = require("assert");
import * as ts from "typescript";
import { createRule } from "../util";

interface NodeWithJSDocNodes extends ts.Node {
  jsDoc: ts.JSDoc[];
}

const hasJSDocNodes: (node: ts.Node) => node is NodeWithJSDocNodes = (ts as any).hasJSDocNodes;

// TODO: improve now that https://github.com/Microsoft/TypeScript/pull/17831 is in
function isInAmbientContext(node: ts.Node): boolean {
  return ts.isSourceFile(node)
    ? node.isDeclarationFile
    : node.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.DeclareKeyword) || isInAmbientContext(node.parent!);
}
const redundantTags = new Set([
  "abstract",
  "access",
  "class",
  "constant",
  "constructs",
  "default",
  "enum",
  "export",
  "exports",
  "function",
  "global",
  "inherits",
  "interface",
  "instance",
  "member",
  "method",
  "memberof",
  "memberOf",
  "mixes",
  "mixin",
  "module",
  "name",
  "namespace",
  "override",
  "property",
  "requires",
  "static",
  "this",
]);

const rule = createRule({
  name: "no-redundant-jsdoc",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Ensure consistency of DefinitelyTyped headers.",
      recommended: "error",
    },
    messages: {
      empty: "JSDoc comment is empty.",
      redundantTag: "JSDoc tag '@{{ tag }}' is redundant in TypeScript code.",
      redundantWithoutComment: "JSDoc tag '@{{ tag }}' is redundant in TypeScript code if it has no description.",
    },
    schema: [],
  },
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const sourceCode = context.getSourceCode();
    const sourceFile = services.esTreeNodeToTSNodeMap.get(sourceCode.ast);

    function checkNode(node: ts.Node) {
      if (node.kind === ts.SyntaxKind.EndOfFileToken || !hasJSDocNodes(node)) {
        return;
      }

      for (const jd of node.jsDoc) {
        const { tags } = jd;
        if (tags === undefined || tags.length === 0) {
          if (jd.comment === undefined) {
            context.report({
              fix(fixer) {
                return fixer.removeRange([jd.getStart(sourceFile), jd.getEnd()]);
              },
              messageId: "empty",
              node: services.tsNodeToESTreeNodeMap.get(node),
            });
          }
        } else {
          for (const tag of tags) {
            checkTag(tag);
          }
        }
      }
    }

    function checkTag(tag: ts.JSDocTag): void {
      const jsdocSeeTag = (ts.SyntaxKind as any).JSDocSeeTag || 0;
      const jsdocDeprecatedTag = (ts.SyntaxKind as any).JSDocDeprecatedTag || 0;
      switch (tag.kind) {
        case jsdocSeeTag:
        case jsdocDeprecatedTag:
        case ts.SyntaxKind.JSDocAuthorTag:
          // @deprecated and @see always have meaning
          break;
        case ts.SyntaxKind.JSDocTag: {
          const { tagName } = tag;
          const { text } = tagName;
          // Allow "default" in an ambient context (since you can't write an initializer in an ambient context)
          if (redundantTags.has(text) && !(text === "default" && isInAmbientContext(tag))) {
            context.report({
              data: { tag: text },
              fix: (fixer) => removeTag(fixer, tag),
              messageId: "redundantTag",
              node: services.tsNodeToESTreeNodeMap.get(tagName),
            });
          }
          break;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore (fallthrough)
        case ts.SyntaxKind.JSDocTemplateTag:
          if (tag.comment !== "") {
            break;
          }
        // falls through

        case ts.SyntaxKind.JSDocPublicTag:
        case ts.SyntaxKind.JSDocPrivateTag:
        case ts.SyntaxKind.JSDocProtectedTag:
        case ts.SyntaxKind.JSDocClassTag:
        case ts.SyntaxKind.JSDocTypeTag:
        case ts.SyntaxKind.JSDocTypedefTag:
        case ts.SyntaxKind.JSDocReadonlyTag:
        case ts.SyntaxKind.JSDocPropertyTag:
        case ts.SyntaxKind.JSDocAugmentsTag:
        case ts.SyntaxKind.JSDocImplementsTag:
        case ts.SyntaxKind.JSDocCallbackTag:
        case ts.SyntaxKind.JSDocThisTag:
        case ts.SyntaxKind.JSDocEnumTag:
          // Always redundant
          context.report({
            data: { tag: tag.tagName.text },
            fix: (fixer) => removeTag(fixer, tag),
            messageId: "redundantTag",
            node: services.tsNodeToESTreeNodeMap.get(tag),
          });
          break;

        case ts.SyntaxKind.JSDocReturnTag:
        case ts.SyntaxKind.JSDocParameterTag: {
          const { typeExpression, comment } = tag as ts.JSDocReturnTag | ts.JSDocParameterTag;
          const noComment = comment === "";
          if (typeExpression !== undefined) {
            // If noComment, we will just completely remove it in the other fix
            context.report({
              data: { tag: tag.tagName.text },
              fix: (fixer) => removeTypeExpression(fixer, typeExpression),
              messageId: "redundantWithoutComment",
              node: services.tsNodeToESTreeNodeMap.get(typeExpression),
            });
          }
          if (noComment) {
            context.report({
              data: { tag: tag.tagName.text },
              fix: (fixer) => removeTag(fixer, tag),
              messageId: "redundantWithoutComment",
              node: services.tsNodeToESTreeNodeMap.get(tag.tagName),
            });
          }
          break;
        }

        default:
          throw new Error(`Unexpected tag kind: ${ts.SyntaxKind[tag.kind]}`);
      }
    }

    function removeTag(fixer: TSESLint.RuleFixer, tag: ts.JSDocTag) {
      const { text } = sourceFile;
      const jsdoc = tag.parent;
      if (jsdoc.kind === ts.SyntaxKind.JSDocTypeLiteral) {
        return null;
      }

      if (jsdoc.comment === undefined && jsdoc.tags!.length === 1) {
        // This is the only tag -- remove the whole comment
        return fixer.removeRange([jsdoc.getStart(sourceFile), jsdoc.getEnd()]);
      }

      let start = tag.getStart(sourceFile);
      assert(text[start] === "@");
      start--;
      while (ts.isWhiteSpaceSingleLine(text.charCodeAt(start))) {
        start--;
      }
      if (text[start] !== "*") {
        return null;
      }

      let end = tag.getEnd();

      // For some tags, like `@param`, `end` will be the start of the next tag.
      // For some tags, like `@name`, `end` will be before the start of the comment.
      // And `@typedef` doesn't end until the last `@property` tag attached to it ends.
      switch (tag.tagName.text) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore (fallthrough)
        case "param": {
          const { isBracketed, isNameFirst, typeExpression } = tag as ts.JSDocParameterTag;
          if (!isBracketed && !(isNameFirst && typeExpression !== undefined)) {
            break;
          }
          // falls through
        }
        // eslint-disable-next-line no-fallthrough
        case "name":
        case "return":
        case "returns":
        case "interface":
        case "default":
        case "memberof":
        case "memberOf":
        case "method":
        case "type":
        case "class":
        case "property":
        case "function":
          end--; // Might end with "\n" (test with just `@return` with no comment or type)
          // For some reason, for "@name", "end" is before the start of the comment part of the tag.
          // Also for "param" if the name is optional  as in `@param {number} [x]`
          while (!ts.isLineBreak(text.charCodeAt(end))) {
            end++;
          }
          end++;
      }
      while (ts.isWhiteSpaceSingleLine(text.charCodeAt(end))) {
        end++;
      }
      if (text[end] !== "*") {
        return null;
      }

      return fixer.removeRange([start, end]);
    }

    function removeTypeExpression(fixer: TSESLint.RuleFixer, typeExpression: ts.JSDocTypeExpression) {
      const start = typeExpression.getStart(sourceFile);
      let end = typeExpression.getEnd();
      const { text } = sourceFile;
      if (text[start] !== "{" || text[end - 1] !== "}") {
        // TypeScript parser messed up -- give up
        return null;
      }
      if (ts.isWhiteSpaceSingleLine(text.charCodeAt(end))) {
        end++;
      }
      return fixer.removeRange([start, end]);
    }

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "*"(node) {
        checkNode(services.esTreeNodeToTSNodeMap.get(node));
      },
    };
  },
});

export = rule;
