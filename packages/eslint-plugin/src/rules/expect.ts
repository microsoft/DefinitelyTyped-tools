import { isDeclarationPath } from "@definitelytyped/utils";
import { createRule } from "../util";
import { ESLintUtils } from "@typescript-eslint/utils";

const rule = createRule({
  name: "expect",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Asserts types with $ExpectType.",
    },
    messages: {
    },
    schema: [],
  },
  create(context) {
    if (isDeclarationPath(context.filename) || !context.sourceCode.text.includes("$ExpectType")) {
        return {};
    }

    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Program(node) {
        const sourceFile = parserServices.esTreeNodeToTSNodeMap.get(node);
        
      }
    };
  },
});

export = rule;
