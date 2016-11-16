import * as Lint from "tslint/lib/lint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "array-type-style",
		description: "Array types should be written with the `Foo[]` syntax",
		rationale: "For consistency",
		options: {},
		type: "style"
	};

	static FAILURE_STRING_OMITTING_SINGLE_PARAMETER = `These overloads can be combined into one signature with an optional parameter.`;
	static FAILURE_STRING_SINGLE_PARAMETER_DIFFERENCE(type1: string, type2: string) {
		return `These overloads can be combined into one signature taking \`${type1} | ${type2}\`.`;
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		this.visitStatements(node.statements);
		super.visitSourceFile(node);
	}

	visitModuleDeclaration(node: ts.ModuleDeclaration) {
		const { body } = node;
		if (body && body.kind === ts.SyntaxKind.ModuleBlock) {
			this.visitStatements((body as ts.ModuleBlock).statements);
		}
		super.visitModuleDeclaration(node);
	}

	visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {
		const signatures = node.members.filter(m => m.kind === ts.SyntaxKind.CallSignature || m.kind === ts.SyntaxKind.MethodSignature) as
			Array<ts.CallSignatureDeclaration | ts.MethodSignature>;
		this.checkOverloads(signatures, node.typeParameters);
		super.visitInterfaceDeclaration(node);
	}

	visitClassDeclaration(node: ts.ClassDeclaration) {
		this.visitMembers(node.members, node.typeParameters);
		super.visitClassDeclaration(node);
	}

	visitTypeLiteral(node: ts.TypeLiteralNode) {
		this.visitMembers(node.members);
		super.visitTypeLiteral(node);
	}

	private visitStatements(statements: ts.Statement[]) {
		this.checkOverloads(statements.filter(statement => statement.kind === ts.SyntaxKind.FunctionDeclaration) as ts.FunctionDeclaration[]);
	}

	private visitMembers(members: Array<ts.TypeElement | ts.ClassElement>, typeParameters?: ts.TypeParameterDeclaration[]) {
		const signatures = members.filter(m =>
			m.kind === ts.SyntaxKind.CallSignature || m.kind === ts.SyntaxKind.MethodSignature || m.kind === ts.SyntaxKind.MethodDeclaration) as
			Array<ts.CallSignatureDeclaration | ts.MethodSignature | ts.MethodDeclaration>;
		this.checkOverloads(signatures, typeParameters);
	}

	private checkOverloads(signatures: ts.SignatureDeclaration[], typeParameters?: ts.TypeParameterDeclaration[]) {
		const typeParametersSet = new Set((typeParameters || []).map(t => t.getText()));
		for (const overloads of collectOverloads(signatures).values()) {
			for (const [a, b] of pairs(overloads)) {
				this.compareSignatures(a, b, type => typeParametersSet.has(type));
			}
		}
	}

	private compareSignatures(a: ts.SignatureDeclaration, b: ts.SignatureDeclaration, isTypeParameter: (type: string) => boolean) {
		if (signatureReturnTypeToString(a) !== signatureReturnTypeToString(b)) {
			return;
		}
		const [sig1, sig2] = [a, b].map(signatureTypesAsStrings);

		// Overloading OK if one signature uses a type parameter and the other doesn't.
		if (sig1.some(isTypeParameter) !== sig2.some(isTypeParameter)) {
			return;
		}

		if (signaturesDifferByOptionalParameter(sig1, sig2)) {
			this.fail(b, Rule.FAILURE_STRING_OMITTING_SINGLE_PARAMETER);
		}
		else {
			const parameterTypes = signaturesDifferBySingleParameter(sig1, sig2);
			if (parameterTypes) {
				this.fail(b, Rule.FAILURE_STRING_SINGLE_PARAMETER_DIFFERENCE(parameterTypes[0], parameterTypes[1]));
			}
		}
	}

	private fail(node: ts.Node, message: string) {
		this.addFailure(this.createFailure(node.getStart(), node.getWidth(), message));
	}
}

function signatureName(node: ts.SignatureDeclaration): string | undefined {
	if (node.kind === ts.SyntaxKind.CallSignature) {
		return "()";
	}
	else {
		return node.name && getTextOfPropertyName(node.name);
	}
}

function collectOverloads(signatures: ts.SignatureDeclaration[]): Map<string, ts.SignatureDeclaration[]> {
	const map = new Map<string, ts.SignatureDeclaration[]>();
	for (const sig of signatures) {
		const name = signatureName(sig);
		if (name !== undefined) {
			const got = map.get(name);
			if (got) {
				got.push(sig);
			}
			else {
				map.set(name, [sig]);
			}
		}
	}
	return map;
}

/** Detect `a(x: number, y: number, z: number)` and `a(x: number, y: string, z: number)`. */
function signaturesDifferBySingleParameter(types1: string[], types2: string[]): [string, string] | undefined {
	if (types1.length !== types2.length) {
		return undefined;
	}

	const index = getIndexOfFirstDifference(types1, types2);
	if (index === undefined) {
		return undefined;
	}

	// If remaining arrays are equal, the signatures differ by just one parameter type
	if (!arraysEqual(types1.slice(index + 1), types2.slice(index + 1))) {
		return undefined;
	}

	const a = types1[index];
	const b = types2[index];
	// Must have equivalent optionality / rest-ness
	if (a.startsWith("?") !== b.startsWith("?") || a.startsWith("...") !== b.startsWith("...")) {
		return undefined;
	}

	return [a, b];
}

/** Detect `a(): void` and `a(x: number): void`. */
function signaturesDifferByOptionalParameter(types1: string[], types2: string[]): boolean {
	const minLength = Math.min(types1.length, types2.length);
	if (types1.length > minLength + 1 || types2.length > minLength + 1) {
		return false;
	}

	for (let i = 0; i < minLength; i++) {
		if (types1[i] !== types2[i]) {
			return false;
		}
	}
	return true;
}

function signatureTypesAsStrings(signature: ts.SignatureDeclaration): string[] {
	return signature.parameters.map(parameter => {
		if (!parameter.type) {
			return "";
		}
		const s = parameter.type.getText();
		return parameter.dotDotDotToken
			? `...${s}`
			: parameter.questionToken
			? `?${s}`
			: s;
	});
}

function signatureReturnTypeToString(signature: ts.SignatureDeclaration): string {
	return signature.type ? signature.type.getText() : "";
}

function arraysEqual(arr1: string[], arr2: string[]): boolean {
	return arr1.length === arr2.length && arr1.every((x, idx) => x === arr2[idx]);
}

function getIndexOfFirstDifference<T>(types1: T[], types2: T[]): number | undefined {
	for (let index = 0; index < types1.length && index < types2.length; index++) {
		if (types1[index] !== types2[index]) {
			return index;
		}
	}
	return undefined;
}

function* pairs<T>(values: T[]): Iterable<[T, T]> {
	for (let i = 0; i < values.length; i++) {
		for (let j = i + 1; j < values.length; j++) {
			yield [values[i], values[j]];
		}
	}
}

function getTextOfPropertyName(name: ts.PropertyName): string | undefined {
	switch (name.kind) {
		case ts.SyntaxKind.Identifier:
			return (<ts.Identifier> name).text;

		case ts.SyntaxKind.StringLiteral:
		case ts.SyntaxKind.NumericLiteral:
			return (<ts.LiteralExpression> name).text;

		case ts.SyntaxKind.ComputedPropertyName:
			if (isStringOrNumericLiteral((<ts.ComputedPropertyName> name).expression.kind)) {
				return (<ts.LiteralExpression> (<ts.ComputedPropertyName> name).expression).text;
			}

		default:
			return undefined;
	}
}

function isStringOrNumericLiteral(kind: ts.SyntaxKind) {
	return kind === ts.SyntaxKind.StringLiteral || kind === ts.SyntaxKind.NumericLiteral;
}

/*
Test case:

type TT = {
	(): void;
	(x: number): void; // error
	x(): void;
	x(x: number): void; // error
	y(x: string): void;
	y(x: number): void; //error
}

interface II {
	(): void;
	(x: number): void; // error
	x(): void;
	x(x: number): void; // error
	y(x: string): void;
	y(x: number): void; //error
}

export class C {
	x(): void;
	x(x: number): void; // error
	y(x: string): void;
	y(x: number): void; //error
}

interface Generic<T> {
	x(): void;
	x(t: T): void; // OK
}
*/
