import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "void-return",
		description: "`void` may only be used as a return type.",
		rationale: "style",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	static FAILURE_STRING = "Use the `void` type for return types only. Otherwise, use `undefined`.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitNode(node: ts.Node) {
		if (node.kind === ts.SyntaxKind.VoidKeyword && !mayContainVoid(node.parent!) && !isReturnType(node)) {
			this.fail(node, Rule.FAILURE_STRING);
		}
		super.visitNode(node);
	}

	private fail(node: ts.Node, message: string) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), message));
	}
}

function mayContainVoid({ kind }: ts.Node): boolean {
	return kind === ts.SyntaxKind.TypeReference || kind === ts.SyntaxKind.NewExpression;
}

function isReturnType(node: ts.Node): boolean {
	let parent = node.parent!;
	if (parent.kind === ts.SyntaxKind.UnionType) {
		[node, parent] = [parent, parent.parent!];
	}
	return isSignatureDeclaration(parent) && parent.type === node;
}

function isSignatureDeclaration(node: ts.Node): node is ts.SignatureDeclaration {
	switch (node.kind) {
		case ts.SyntaxKind.ArrowFunction:
		case ts.SyntaxKind.CallSignature:
		case ts.SyntaxKind.FunctionDeclaration:
		case ts.SyntaxKind.FunctionType:
		case ts.SyntaxKind.MethodDeclaration:
		case ts.SyntaxKind.MethodSignature:
			return true;

		default:
			return false;
	}
}
