import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-parent-references",
		description: 'Forbid <reference path="../etc"/>',
		rationale: "Parent references are not inferred as dependencies by types-publisher.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	static FAILURE_STRING = "Don't use <reference path> to reference another package. Use an import or <reference types> instead.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		for (const ref of node.referencedFiles) {
			if (ref.fileName.startsWith("..")) {
				this.addFailure(this.createFailure(ref.pos, ref.end, Rule.FAILURE_STRING));
			}
		}
	}
}
