import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../util";

interface ExportAssignmentWithIdentifier extends TSESTree.TSExportAssignment {
  expression: TSESTree.Identifier;
}

const rule = createRule({
  name: "export-just-namespace",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbids `export = foo` where `foo` is a namespace and isn't merged with a function/class/type/interface.",
      recommended: "error",
    },
    messages: {
      useTheBody: "Instead of `export =`-ing a namespace, use the body of the namespace as the module body.",
    },
    schema: [],
  },
  create(context) {
    const ast = context.getSourceCode().ast;

    const exportEqualsNode = ast.body.find(isExportEqualsWithIdentifier);
    if (!exportEqualsNode) {
      return {};
    }

    if (isJustNamespace(ast.body, exportEqualsNode.expression.name)) {
      context.report({
        messageId: "useTheBody",
        node: exportEqualsNode,
      });
    }

    return {};
  },
});

/**
 * @returns Where there is a namespace but there are no functions/classes/etc. with the same name.
 */
function isJustNamespace(statements: TSESTree.ProgramStatement[], exportEqualsName: string): boolean {
  let anyNamespace = false;

  for (const statement of statements) {
    switch (statement.type) {
      case AST_NODE_TYPES.TSModuleDeclaration:
        anyNamespace ||= nameMatches(statement.id);
        break;
      case AST_NODE_TYPES.VariableDeclaration:
        if (statement.declarations.some((d) => nameMatches(d.id))) {
          // OK. It's merged with a variable.
          return false;
        }
        break;
      case AST_NODE_TYPES.ClassDeclaration:
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.TSDeclareFunction:
      case AST_NODE_TYPES.TSTypeAliasDeclaration:
      case AST_NODE_TYPES.TSInterfaceDeclaration:
        if (nameMatches(statement.id)) {
          // OK. It's merged with a function/class/type/interface.
          return false;
        }
        break;
    }
  }

  return anyNamespace;

  function nameMatches(nameNode: TSESTree.Node | undefined | null): boolean {
    return !!nameNode && nameNode.type === AST_NODE_TYPES.Identifier && nameNode.name === exportEqualsName;
  }
}

function isExportEqualsWithIdentifier(node: TSESTree.Node): node is ExportAssignmentWithIdentifier {
  return node.type === AST_NODE_TYPES.TSExportAssignment && node.expression.type === AST_NODE_TYPES.Identifier;
}

export = rule;
