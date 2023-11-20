import { TSESTree } from "@typescript-eslint/utils";
import { createRule, commentsMatching, findTypesPackage, getImportSource } from "../util";
import { isDeclarationPath, isTypesPackageName, typesPackageNameToRealName } from "@definitelytyped/utils";

type MessageId = "noImportOfDevDependencies" | "noReferenceOfDevDependencies";
const rule = createRule({
  name: "no-import-of-dev-dependencies",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbid imports and references to devDependencies inside .d.ts files.",
    },
    messages: {
      noImportOfDevDependencies: `.d.ts files may not import packages in devDependencies.`,
      noReferenceOfDevDependencies: `.d.ts files may not triple-slash reference packages in devDependencies.`,
    },
    schema: [],
  },
  create(context) {
    if (!isDeclarationPath(context.filename)) {
      return {};
    }

    const info = findTypesPackage(context.filename);
    if (!info) {
      return {};
    }

    const packageJson = info.packageJson;
    if (!packageJson.devDependencies) {
      return {};
    }

    const devDeps = Object.keys(packageJson.devDependencies)
      .map((dep) => {
        if (isTypesPackageName(dep)) {
          return typesPackageNameToRealName(dep);
        }
        return dep;
      })
      .filter((dep) => dep !== info.realName && packageJson.dependencies?.[dep] === undefined); // TODO(jakebailey): add test for this case from https://github.com/microsoft/DefinitelyTyped-tools/pull/773

    commentsMatching(context.sourceCode, /<reference\s+types\s*=\s*"(.+)"\s*\/>/, (ref, comment) => {
      if (devDeps.includes(ref)) {
        report(comment, "noReferenceOfDevDependencies");
      }
    });

    function lint(node: TSESTree.ImportDeclaration | TSESTree.TSImportEqualsDeclaration) {
      const source = getImportSource(node);
      if (!source) {
        return;
      }

      if (devDeps.includes(source.value)) {
        context.report({
          messageId: "noImportOfDevDependencies",
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

    function report(comment: TSESTree.Comment, messageId: MessageId) {
      context.report({
        loc: {
          end: {
            column: comment.value.lastIndexOf(`"`),
            line: comment.loc.end.line,
          },
          start: {
            column: comment.value.indexOf(`"`) + 1,
            line: comment.loc.start.line,
          },
        },
        messageId,
      });
    }
  },
});

export = rule;
