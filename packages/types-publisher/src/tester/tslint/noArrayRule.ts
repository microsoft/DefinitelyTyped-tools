import * as Lint from "tslint/lib/lint";
import * as ts from "typescript";

/** Rule wrapper. */
export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-array",
		description: "Array types should be written with the `Foo[]` syntax",
		rationale: "For consistency",
		options: {},
		type: "style"
	}

	static failureString(arg: string) {
		return `Prefer ${arg}[] over Array<${arg}>`;
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

/** Visitor that checks an individual node for documentation. */
class Walker extends Lint.RuleWalker {
	visitTypeReference(node: ts.TypeReferenceNode) {
		const name = node.typeName.getText();
		if (name === "Array" && node.typeArguments) { // else it's a compile error, because Array needs arguments
			const arg = node.typeArguments[0];
			this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.failureString(arg.getText())));
		}
	}
}
