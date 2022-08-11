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
    // Each of these functions generally doesn't return anything,
    // but may call context.report(...) if it finds a complaint
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'TSExportAssignment[expression.type="Identifier"]'(node: ExportAssignmentWithIdentifier) {
        // TODO:
        // * Make sure the identifier is a namespace
        // * Only complain if the identifier has previously been used to declare other things
        context.report({
          messageId: "useTheBody",
          node,
        });
      },
    };
  },
});

export = rule;
