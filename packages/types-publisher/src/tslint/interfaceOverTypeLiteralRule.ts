import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "interface-over-type-literal",
		description: "Prefer an interface declaration over `type T = { ... }`",
		rationale: "For consistency",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	static FAILURE_STRING = "Use an interface instead.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration) {
		if (node.type.kind === ts.SyntaxKind.TypeLiteral) {
			this.fail(node);
		}

		super.visitTypeAliasDeclaration(node);
	}

	private fail(node: ts.Node) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE_STRING));
	}
}
