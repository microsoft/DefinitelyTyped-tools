import * as Lint from "tslint/lib/lint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-empty-interface",
		description: "Forbids empty interfaces",
		rationale: "Empty interfaces as not useful.",
		options: {},
		type: "style"
	};

	static FAILURE_STRING = "An empty interface is equivalent to `{}`.";
	static FAILURE_STRING_FOR_EXTENDS = "An interface declaring no members is equivalent to its supertype.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitInterfaceDeclaration(node: ts.InterfaceDeclaration) {
		if (node.members.length === 0) {
			this.fail(node, node.heritageClauses ? Rule.FAILURE_STRING_FOR_EXTENDS : Rule.FAILURE_STRING);
		}
		super.visitInterfaceDeclaration(node);
	}

	private fail(node: ts.Node, message: string) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), message));
	}
}
