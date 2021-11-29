// Fixes temporarily moved here until they are published by tslint.

import assert = require("assert");
import * as Lint from "tslint";
import { canHaveJsDoc, getJsDoc } from "tsutils"; // tslint:disable-line no-implicit-dependencies (from tslint)
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	/* tslint:disable:object-literal-sort-keys */
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-redundant-jsdoc",
		description: "Forbids JSDoc which duplicates TypeScript functionality.",
		optionsDescription: "Not configurable.",
		options: null,
		optionExamples: [true],
		type: "style",
		typescriptOnly: true,
	};
	/* tslint:enable:object-literal-sort-keys */

	static readonly FAILURE_STRING_REDUNDANT_TYPE =
		"Type annotation in JSDoc is redundant in TypeScript code.";
	static readonly FAILURE_STRING_EMPTY =
		"JSDoc comment is empty.";
	static FAILURE_STRING_REDUNDANT_TAG(tagName: string): string {
		return `JSDoc tag '@${tagName}' is redundant in TypeScript code.`;
	}
	static FAILURE_STRING_NO_COMMENT(tagName: string): string {
		return `'@${tagName}' is redundant in TypeScript code if it has no description.`;
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	// Intentionally exclude EndOfFileToken: it can have JSDoc, but it is only relevant in JavaScript files
	return sourceFile.statements.forEach(function cb(node: ts.Node): void {
		if (canHaveJsDoc(node)) {
			for (const jd of getJsDoc(node, sourceFile)) {
				const { tags } = jd;
				if (tags === undefined || tags.length === 0) {
					if (jd.comment === undefined) {
						ctx.addFailureAtNode(
							jd,
							Rule.FAILURE_STRING_EMPTY,
							Lint.Replacement.deleteFromTo(jd.getStart(sourceFile), jd.getEnd()));
					}
				} else {
					for (const tag of tags) {
						checkTag(tag);
					}
				}
			}
		}
		return ts.forEachChild(node, cb);
	});

	function checkTag(tag: ts.JSDocTag): void {
		switch (tag.kind) {
			case ts.SyntaxKind.JSDocTag: {
				const { tagName } = tag;
				const { text } = tagName;
				// Allow "default" in an ambient context (since you can't write an initializer in an ambient context)
				if (redundantTags.has(text) && !(text === "default" && isInAmbientContext(tag))) {
					ctx.addFailureAtNode(tagName, Rule.FAILURE_STRING_REDUNDANT_TAG(text), removeTag(tag, sourceFile));
				}
				break;
			}

			// @ts-ignore (fallthrough)
			case ts.SyntaxKind.JSDocTemplateTag:
				if (tag.comment !== "") {
					break;
				}
				// falls through

			case ts.SyntaxKind.JSDocClassTag:
			case ts.SyntaxKind.JSDocTypeTag:
			case ts.SyntaxKind.JSDocTypedefTag:
			case ts.SyntaxKind.JSDocPropertyTag:
			case ts.SyntaxKind.JSDocAugmentsTag:
			case ts.SyntaxKind.JSDocCallbackTag:
				// Always redundant
				ctx.addFailureAtNode(tag.tagName, Rule.FAILURE_STRING_REDUNDANT_TAG(tag.tagName.text), removeTag(tag, sourceFile));
				break;

			case ts.SyntaxKind.JSDocReturnTag:
			case ts.SyntaxKind.JSDocParameterTag: {
				const { typeExpression, comment } = tag as ts.JSDocReturnTag | ts.JSDocParameterTag;
				const noComment = comment === "";
				if (typeExpression !== undefined) {
					// If noComment, we will just completely remove it in the other fix
					const fix = noComment ? undefined : removeTypeExpression(typeExpression, sourceFile);
					ctx.addFailureAtNode(typeExpression, Rule.FAILURE_STRING_REDUNDANT_TYPE, fix);
				}
				if (noComment) {
					// Redundant if no documentation
					ctx.addFailureAtNode(tag.tagName, Rule.FAILURE_STRING_NO_COMMENT(tag.tagName.text), removeTag(tag, sourceFile));
				}
				break;
			}

			default:
				throw new Error(`Unexpected tag kind: ${ts.SyntaxKind[tag.kind]}`);
		}
	}
}

function removeTag(tag: ts.JSDocTag, sourceFile: ts.SourceFile): Lint.Replacement | undefined {
	const { text } = sourceFile;
	const jsdoc = tag.parent;
	if (jsdoc.kind === ts.SyntaxKind.JSDocTypeLiteral) {
		return undefined;
	}

	if (jsdoc.comment === undefined && jsdoc.tags!.length === 1) {
		// This is the only tag -- remove the whole comment
		return Lint.Replacement.deleteFromTo(jsdoc.getStart(sourceFile), jsdoc.getEnd());
	}

	let start = tag.getStart(sourceFile);
	assert(text[start] === "@");
	start--;
	while (ts.isWhiteSpaceSingleLine(text.charCodeAt(start))) {
		start--;
	}
	if (text[start] !== "*") {
		return undefined;
	}

	let end = tag.getEnd();

	// For some tags, like `@param`, `end` will be the start of the next tag.
	// For some tags, like `@name`, `end` will be before the start of the comment.
	// And `@typedef` doesn't end until the last `@property` tag attached to it ends.
	switch (tag.tagName.text) {
		// @ts-ignore (fallthrough)
		case "param":
			const { isBracketed, isNameFirst, typeExpression } = tag as ts.JSDocParameterTag;
			if (!isBracketed && !(isNameFirst && typeExpression !== undefined)) {
				break;
			}
			// falls through
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
		return undefined;
	}

	return Lint.Replacement.deleteFromTo(start, end);
}

function removeTypeExpression(
	typeExpression: ts.JSDocTypeExpression,
	sourceFile: ts.SourceFile,
): Lint.Replacement | undefined {
	const start = typeExpression.getStart(sourceFile);
	let end = typeExpression.getEnd();
	const { text } = sourceFile;
	if (text[start] !== "{" || text[end - 1] !== "}") {
		// TypeScript parser messed up -- give up
		return undefined;
	}
	if (ts.isWhiteSpaceSingleLine(text.charCodeAt(end))) {
		end++;
	}
	return Lint.Replacement.deleteFromTo(start, end);
}

// TODO: improve once https://github.com/Microsoft/TypeScript/pull/17831 is in
function isInAmbientContext(node: ts.Node): boolean {
	return ts.isSourceFile(node)
		? node.isDeclarationFile
		: Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword) || isInAmbientContext(node.parent!);
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
	"implements",
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
	"private",
	"property",
	"protected",
	"public",
	"readonly",
	"requires",
	"static",
	"this",
]);
