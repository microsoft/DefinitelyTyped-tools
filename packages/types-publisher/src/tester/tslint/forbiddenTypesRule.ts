import * as Lint from "tslint/lib/lint";
import * as ts from "typescript";

/** Rule wrapper. */
export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "forbidden-types",
		description: "Frbid the Function, Object, Boolean, Number, and String types.",
		rationale: "Certain types are never a good idea.",
		options: {},
		type: "functionality"
	}

    static upperCaseFailureString(name: string) {
        return `Avoid using the ${name} type. You probably meant ${name.toLowerCase()}`;
    }

    static FUNCTION_FAILURE_STRING = "Avoid using the Function type. Prefer a specific function type, like `() => void`.";

    static OBJECT_FAILURE_STRING = "Avoid using the Object type. Did you mean `any` or `{}`?";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()))
	}
}

/** Visitor that checks an individual node for documentation. */
class Walker extends Lint.RuleWalker {
	visitTypeReference(node: ts.TypeReferenceNode) {
		const name = node.typeName.getText();
        const failure = nameFailure(name);
        if (failure) {
			this.addFailure(this.createFailure(node.getStart(), node.getWidth(), failure));
        }
	}
}

function nameFailure(name: string): string | undefined {
    switch (name) {
        case "Function":
            return Rule.FUNCTION_FAILURE_STRING;
        case "Object":
            return Rule.OBJECT_FAILURE_STRING;
        case "Boolean": case "Number": case "String":
            return Rule.upperCaseFailureString(name);
        default:
            return undefined;
    }
}
