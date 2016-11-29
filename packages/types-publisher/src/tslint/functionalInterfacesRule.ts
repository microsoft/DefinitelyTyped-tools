import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "functional-interface",
		description: "An interface with just a call signature can be written as a function type.",
		rationale: "For simplicity",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	static failureString(name: string, { parameters, returnType }: Signature): string {
		const suggestion = `type ${name} = (${parameters}) => ${returnType}`;
		const disable = "Use `// tslint:disable-next-line:functional-interfaces` if you will extend this interface.";
		return `Interface has only a call signature — use \`${suggestion}\` instead.\n${disable}`;
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitInterfaceDeclaration(node: ts.InterfaceDeclaration) {
		if (noSupertype(node.heritageClauses) && node.members.length === 1 && node.members[0].kind === ts.SyntaxKind.CallSignature) {
			const sig = signatureString(node.members[0] as ts.CallSignatureDeclaration);
			if (sig) {
				this.fail(node, Rule.failureString(node.name!.getText(), sig));
			}
		}

		super.visitInterfaceDeclaration(node);
	}

	private fail(node: ts.Node, message: string) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), message));
	}
}

/** True if there is no supertype or if the supertype is `Function`. */
function noSupertype(heritageClauses: ts.NodeArray<ts.HeritageClause> | undefined): boolean {
	if (!heritageClauses) {
		return true;
	}

	if (heritageClauses.length === 1) {
		const expr = heritageClauses[0].types![0].expression;
		if (expr.kind === ts.SyntaxKind.Identifier && (expr as ts.Identifier).text === "Function") {
			return true;
		}
	}

	return false;
}

function signatureString(node: ts.SignatureDeclaration): Signature | undefined {
	return node.type && {
		parameters: node.parameters.map(p => p.getText()).join(", "),
		returnType: node.type.getText()
	};
}

interface Signature {
	parameters: string;
	returnType: string;
}
