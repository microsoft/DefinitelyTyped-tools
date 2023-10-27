import { isDeclarationPath } from "@definitelytyped/utils";
import { createRule } from "../util";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";

const rule = createRule({
  name: "no-import-default-of-export-equals",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbid a default import to reference an `export =` module.",
      recommended: "error",
    },
    messages: {
      noImportDefaultOfExportEquals: `The module {{moduleName}} uses \`export = \`. Import with \`import {{importName}} = require({{moduleName}})\`.`,
    },
    schema: [],
  },
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();
    if (isDeclarationPath(context.getFilename())) {
      return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ImportDeclaration(node) {
          const defaultName = node.specifiers.find((spec) => spec.type === "ImportDefaultSpecifier")?.local;
          if (!defaultName) {
            return;
          }
          const importName = defaultName.name;
          const source = parserServices.esTreeNodeToTSNodeMap.get(node.source);
          const sym = checker.getSymbolAtLocation(source);
          if (
            sym?.declarations?.some((d) =>
              getStatements(d)?.some((s) => ts.isExportAssignment(s) && !!s.isExportEquals)
            )
          ) {
            context.report({
              messageId: "noImportDefaultOfExportEquals",
              data: { moduleName: node.source.value, importName },
              node: defaultName,
            });
          }
        },
      };
    } else {
      return {};
    }
  },
});

function getStatements(decl: ts.Declaration): readonly ts.Statement[] | undefined {
  return ts.isSourceFile(decl)
    ? decl.statements
    : ts.isModuleDeclaration(decl)
    ? getModuleDeclarationStatements(decl)
    : undefined;
}

function getModuleDeclarationStatements(node: ts.ModuleDeclaration): readonly ts.Statement[] | undefined {
  let { body } = node;
  while (body && body.kind === ts.SyntaxKind.ModuleDeclaration) {
    body = body.body;
  }
  return body && ts.isModuleBlock(body) ? body.statements : undefined;
}

export = rule;
