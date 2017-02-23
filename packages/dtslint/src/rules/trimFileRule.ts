import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	public static metadata: Lint.IRuleMetadata = {
		ruleName: "trim-file",
		description: "Forbids leading/trailing blank lines in a file. Allows file to end in '\n'.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: false,
	};

	public static FAILURE_STRING_LEADING = "File should not begin with a blank line.";
	public static FAILURE_STRING_TRAILING = "File should not end with a blank line. (Ending in '\n' OK, ending in '\n\n' not OK.)";

	public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(sourceFile: ts.SourceFile) {
		const { text } = sourceFile;
		if (text.startsWith("\n")) {
			this.addFailureAt(0, 1, Rule.FAILURE_STRING_LEADING);
		}

		if (text.endsWith("\n\n")) {
			this.addFailureAt(text.length - 1, 1, Rule.FAILURE_STRING_TRAILING);
		}
	}
}
