import * as ts from "typescript";

export function isExternalModule(src: ts.SourceFile): boolean {
	return !!(src as any).externalModuleIndicator;
}
