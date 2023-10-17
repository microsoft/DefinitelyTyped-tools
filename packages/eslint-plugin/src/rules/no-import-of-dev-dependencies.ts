import { TSESTree } from "@typescript-eslint/utils";
import { createRule, commentsMatching, getTypesPackageForDeclarationFile } from "../util";
import fs from "fs";
import path from "path";

type MessageId = "noImportOfDevDependencies" | "noReferenceOfDevDependencies";
const rule = createRule({
  name: "no-import-of-dev-dependencies",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Forbid imports and references to devDependencies inside .d.ts files.",
      recommended: "error",
    },
    messages: {
      noImportOfDevDependencies: `.d.ts files may not import packages in devDependencies.`,
      noReferenceOfDevDependencies: `.d.ts files may not triple-slash reference packages in devDependencies.`,
    },
    schema: [],
  },
  create(context) {
    const packageName = getTypesPackageForDeclarationFile(context.getFilename());
    if (context.getFilename().endsWith(".d.ts")) {
      const packageJson = getPackageJson(context.getPhysicalFilename?.() ?? context.getFilename());
      const devdeps = packageJson
        ? Object.keys(packageJson.devDependencies).map((dep) => dep.replace(/@types\//, ""))
        : [];
      commentsMatching(context.getSourceCode(), /<reference\s+types\s*=\s*"(.+)"\s*\/>/, (ref, comment) => {
        if (devdeps.includes(ref) && ref !== packageName) {
          report(comment, "noReferenceOfDevDependencies");
        }
      });

      return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ImportDeclaration(node) {
          if (devdeps.includes(node.source.value) && node.source.value !== packageName) {
            context.report({
              messageId: "noImportOfDevDependencies",
              node,
            });
          }
        },
      };
    } else {
      return {};
    }
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
function getPackageJson(sourceFile: string): { devDependencies: Record<string, string> } | undefined {
  let dir = path.dirname(sourceFile);
  let text: string | undefined;
  while (dir !== "/") {
    try {
      text = fs.readFileSync(path.join(dir, "package.json"), "utf8");
      break;
    } catch {
      // presumably because file does not exist, so continue
    }
    dir = path.dirname(dir);
  }
  if (!text) return undefined;
  const json = JSON.parse(text);
  if ("devDependencies" in json) return json;
  return undefined;
}

export = rule;
