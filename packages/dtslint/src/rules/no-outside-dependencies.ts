import { createRule } from "../util";
import { ESLintUtils } from "@typescript-eslint/utils";
const rule = createRule({
  name: "no-outside-dependencies",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Don't use an ambient module declaration of the current package; use a normal module.",
      recommended: "error",
    },
    messages: {
      noOutsideDependencies: `File {{fileName}} comes from a \`node_modules\` but is not declared in this type's \`package.json\`. `
    },
    schema: [],
  },
  create(context) {
    if (context.getFilename().endsWith("index.d.ts")) {
      const parserServices = ESLintUtils.getParserServices(context);
      const hasNodeReference = parserServices.program.getSourceFiles().some(f => f.typeReferenceDirectives.some(dir => dir.fileName === "node"));
      for (const sourceFile of parserServices.program.getSourceFiles()) {
        const fileName = sourceFile.fileName;
        if (fileName.includes("/DefinitelyTyped/node_modules/")
          && !parserServices.program.isSourceFileDefaultLibrary(sourceFile)
          && !(hasNodeReference && fileName.includes("buffer"))) {
          context.report({
            messageId: "noOutsideDependencies",
            data: { fileName },
            loc: { column: 0, line: 1 }
          })
        }
      }
    }
    return {};
  },
});

export = rule;
