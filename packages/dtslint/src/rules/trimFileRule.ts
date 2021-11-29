import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "trim-file",
		description: "Forbids leading/trailing blank lines in a file. Allows file to end in '\n'.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: false,
	};

	static FAILURE_STRING_LEADING = "File should not begin with a blank line.";
	static FAILURE_STRING_TRAILING =
		"File should not end with a blank line. (Ending in one newline OK, ending in two newlines not OK.)";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile: { text } } = ctx;
	if (text.startsWith("\r") || text.startsWith("\n")) {
		ctx.addFailureAt(0, 0, Rule.FAILURE_STRING_LEADING);
	}

	if (text.endsWith("\n\n") || text.endsWith("\r\n\r\n")) {
		ctx.addFailureAt(text.length - 1, 0, Rule.FAILURE_STRING_TRAILING);
	}
}
