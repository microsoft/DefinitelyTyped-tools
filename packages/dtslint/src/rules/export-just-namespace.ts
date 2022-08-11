import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../util";

interface ExportAssignmentWithIdentifier extends TSESTree.TSExportAssignment {
  expression: TSESTree.Identifier;
}

/*
ESLint rule that will ban code like this:
    export = stuff;
    declare namespace stuff {
        function doThings(): void;
    }
...in favor of code like this:
    export function doThings(): void;
*/
const rule = createRule({
  name: "export-just-namespace",
  defaultOptions: [],
  // Metadata: a bit of docs, and the possible message IDs it'll log
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
  // Takes in an object with ESLint APIs such as report (which makes a create),
  // and returns an object with key/value pairs:
  //   * keys: Queries similar to CSS queries, but for AST nodes
  //   * values: function to run on each node matching the query
  // AST = Abstract Syntax Tree, a representation of the nodes in your code
  //   reference: see astexplorer.net
  create(context) {
    const ast = context.getSourceCode().ast;

    const exportEqualsNode = ast.body.find(isExportEquals);
    if (!exportEqualsNode) {
      return {};
    }

    if (isJustNamespace(ast.body, exportEqualsNode.expression.name)) {
      context.report({
        messageId: "useTheBody",
        node: exportEqualsNode,
      });
    }

    // TODO:
    // * Make sure the identifier is a namespace
    // * Only complain if the identifier has previously been used to declare other things

    // // Each of these functions generally doesn't return anything,
    // // but may call context.report(...) if it finds a complaint
    // return {
    //   // eslint-disable-next-line @typescript-eslint/naming-convention
    //   'TSExportAssignment[expression.type="Identifier"]'(node: ExportAssignmentWithIdentifier) {},
    // };
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
      // We've found the namespace, maybe!
      // TODO: if we just assume anyNamespace is true.. like, why do we need it?
      case AST_NODE_TYPES.TSModuleDeclaration:
        // If the name is the same as what we're looking for, then yes, we found it
        anyNamespace ||= nameMatches(statement.id);
        break;
      /*
        const MyName = function () {};

        namespace MyName { ... }

        export = MyName;
      */
      case AST_NODE_TYPES.VariableDeclaration:
        if (statement.declarations.some((d) => nameMatches(d.id))) {
          // OK. It's merged with a variable.
          return false;
        }
        break;
      /*
        class MyName { ... }
      
        namespace MyName { ... }

        export = MyName;
      */
      case AST_NODE_TYPES.ClassDeclaration:
      case AST_NODE_TYPES.FunctionDeclaration:
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

  function nameMatches(nameNode: TSESTree.Node | undefined): boolean {
    return nameNode !== undefined && nameNode.type === AST_NODE_TYPES.Identifier && nameNode.name === exportEqualsName;
  }
}

function isExportEquals(node: TSESTree.Node): node is ExportAssignmentWithIdentifier {
  return node.type === AST_NODE_TYPES.TSExportAssignment && node.expression.type === AST_NODE_TYPES.Identifier;
}

export = rule;
