import { ESLintUtils } from "@typescript-eslint/utils";
import { createRule, getCommonDirectoryName } from "../util";

const rule = createRule({
  name: "no-self-import",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbids declaration files to import the current package using a global import.",
      recommended: "error",
    },
    messages: {
      useRelativeImport: "Declaration file should not use a global import of itself. Use a relative import.",
    },
    schema: [],
  },
  create(context) {
    if (!context.getFilename().endsWith(".d.ts")) {
      return {};
    }

    const services = ESLintUtils.getParserServices(context);
    const packageName = getCommonDirectoryName(services.program.getRootFileNames());

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ImportDeclaration(node) {
        if (node.source.value === packageName || node.source.value.startsWith(packageName + "/")) {
          context.report({
            messageId: "useRelativeImport",
            node,
          });
        }
      },
    };
  },
});

export = rule;
