import * as Lint from "tslint/lib/lint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-public",
		description: "Forbids the 'public' keyword.",
		rationale: "For simplicity",
		options: {},
		type: "style"
	};

	static FAILURE_STRING = "No need to write `public`; this is implicit.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitConstructorDeclaration(node: ts.ConstructorDeclaration) {
		this.check(node);
		super.visitConstructorDeclaration(node);
	}

	visitMethodDeclaration(node: ts.MethodDeclaration) {
		this.check(node);
		super.visitMethodDeclaration(node);
	}

	visitPropertyDeclaration(node: ts.PropertyDeclaration) {
		this.check(node);
		super.visitPropertyDeclaration(node);
	}

	visitGetAccessor(node: ts.AccessorDeclaration) {
		this.check(node);
		super.visitGetAccessor(node);
	}

	visitSetAccessor(node: ts.AccessorDeclaration) {
		this.check(node);
		super.visitSetAccessor(node);
	}

	private check(node: ts.Node) {
		if (node.modifiers && Lint.hasModifier(node.modifiers, ts.SyntaxKind.PublicKeyword)) {
			this.fail(node, Rule.FAILURE_STRING);
		}
	}

	private fail(node: ts.Node, message: string) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), message));
	}
}
