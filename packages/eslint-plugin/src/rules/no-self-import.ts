import { createRule, getTypesPackageForDeclarationFile } from "../util";
const rule = createRule({
  name: "no-self-import",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbids declaration files to import the current package using a global import or old versions with a relative import.",
      recommended: "error",
    },
    messages: {
      useRelativeImport: "Declaration file should not use a global import of itself. Use a relative import.",
      useOnlyCurrentVersion: "Don't import an old version of the current package.",
    },
    schema: [],
  },
  create(context) {
    const packageName = getTypesPackageForDeclarationFile(context.getFilename());
    if (!packageName) {
      return {};
    }

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ImportDeclaration(node) {
        if (node.source.value === packageName || node.source.value.startsWith(packageName + "/")) {
          context.report({
            messageId: "useRelativeImport",
            node,
          });
        } else if (node.source.value.match(/^\.\/v\d+(?:\.\d+)?(?:\/.*)?$/)) {
          context.report({
            messageId: "useOnlyCurrentVersion",
            node,
          });
        }
      },
    };
  },
});

export = rule;
