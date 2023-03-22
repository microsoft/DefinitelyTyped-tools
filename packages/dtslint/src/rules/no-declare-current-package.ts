import { getCommonDirectoryName, createRule } from "../util";
import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
const rule = createRule({
  name: "no-declare-current-package",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Don't use an ambient module declaration of the current package; use a normal module.",
      recommended: "error",
    },
    messages: {
      noDeclareCurrentPackage: `Instead of declaring a module with \`declare module "{{ text }}"\`, ` +
        `write its contents in directly in {{ preferred }}.`,
    },
    schema: [],
  },
  create(context) {
    if (!context.getFilename().endsWith(".d.ts")) {
      return {}
    }
    const parserServices = ESLintUtils.getParserServices(context);
    const packageName = getCommonDirectoryName(parserServices.program.getRootFileNames());
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TSModuleDeclaration(node) {
        if (node.id.type === AST_NODE_TYPES.Literal
          && (node.id.value === packageName || node.id.value.startsWith(packageName + "/"))) {
          const text = node.id.value;
          const preferred = text === packageName ? '"index.d.ts"' : `"${text}.d.ts" or "${text}/index.d.ts`;
          context.report({
            messageId: "noDeclareCurrentPackage",
            data: { text, preferred },
            node,
          });
        }
      },
    };
  },
});

export = rule;
