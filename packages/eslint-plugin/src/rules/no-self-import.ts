import { TSESTree } from "@typescript-eslint/utils";
import { createRule, getImportSource, getTypesPackageForDeclarationFile } from "../util";
const rule = createRule({
  name: "no-self-import",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbids declaration files to import the current package using a global import or old versions with a relative import.",
    },
    messages: {
      useRelativeImport: "Declaration file should not use a global import of itself. Use a relative import.",
      useOnlyCurrentVersion: "Don't import an old version of the current package.",
    },
    schema: [],
  },
  create(context) {
    const packageName = getTypesPackageForDeclarationFile(context.filename);
    if (!packageName) {
      return {};
    }

    function lint(node: TSESTree.ImportDeclaration | TSESTree.TSImportEqualsDeclaration) {
      const source = getImportSource(node);
      if (!source) {
        return;
      }

      if (source.value === packageName || source.value.startsWith(packageName + "/")) {
        context.report({
          messageId: "useRelativeImport",
          node,
        });
      } else if (source.value.match(/^\.\/v\d+(?:\.\d+)?(?:\/.*)?$/)) {
        context.report({
          messageId: "useOnlyCurrentVersion",
          node,
        });
      }
    }

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ImportDeclaration(node) {
        lint(node);
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TSImportEqualsDeclaration(node) {
        lint(node);
      },
    };
  },
});

export = rule;
