import * as Lint from "tslint";
import * as ts from "typescript";
import * as path from "path";

import { validate, renderExpected } from "../lib/header";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "dt-header",
		description: "Ensure consistency of DefinitelyTyped headers.",
		rationale: "Consistency is a good.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		const text = node.getFullText();

		if (!isMainFile(node.fileName)) {
			if (text.startsWith("// Type definitions for")) {
				this.addFailure(this.createFailure(0, 1, "Header should only be in `index.d.ts`."));
			}
			return;
		}

		const error = validate(text);
		if (error) {
			this.addFailure(this.createFailure(error.index, error.index + 1, `Error parsing header. Expected: ${renderExpected(error.expected)}`));
		}
		// Don't recurse, we're done.
	}
}

/** Whether it's `foo/index.d.ts` */
function isMainFile(fileName: string) {
	const parts = fileName.split(path.sep);
	return parts.length === 2 && parts[1] === "index.d.ts";
}
