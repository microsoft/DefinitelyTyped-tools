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
		if (node.kind === ts.SyntaxKind.VoidKeyword && !isPromiseType(node) && !isReturnType(node)) {
			this.fail(node, Rule.FAILURE_STRING);
		}
		super.visitNode(node);
	}

	private fail(node: ts.Node, message: string) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), message));
	}
}

function isPromiseType(node: ts.Node): boolean {
	const parent = node.parent!;
	switch (parent.kind) {
		case ts.SyntaxKind.TypeReference: {
			const ref = parent as ts.TypeReferenceNode;
			return isPromiseIdentifier(ref.typeName) && ref.typeArguments![0] === node;
		}
		case ts.SyntaxKind.NewExpression: {
			const ctr = parent as ts.NewExpression;
			return isPromiseIdentifier(ctr.expression) && ctr.typeArguments![0] === node;
		}
		default:
			return false;
	}

}

function isPromiseIdentifier(node: ts.Node): boolean {
	return node.kind === ts.SyntaxKind.Identifier && (node as ts.Identifier).text === "Promise";
}

function isReturnType(node: ts.Node): boolean {
	const parent = node.parent!;
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
