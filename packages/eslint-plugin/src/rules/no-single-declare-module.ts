import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";

import { createRule } from "../util";

const rule = createRule({
  defaultOptions: [],
  meta: {
    docs: {
      description: "Don't use an ambient module declaration if there's just one -- write it as a normal module.",
    },
    messages: {
      oneModuleDeclaration:
        "File has only 1 ambient module declaration. Move the contents outside the ambient module block, rename the file to match the ambient module name, and remove the block.",
    },
    schema: [],
    type: "problem",
  },
  name: "no-single-declare-module",
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const sourceFile = services.esTreeNodeToTSNodeMap.get(context.getSourceCode().ast);

    // If it's an external module, any module declarations inside are augmentations.
    if (ts.isExternalModule(sourceFile)) {
      return {};
    }

    let moduleDeclaration: ts.ModuleDeclaration | undefined;
    for (const statement of sourceFile.statements) {
      if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
        if (statement.name.text.indexOf("*") !== -1) {
          // Ignore wildcard module declarations
          return {};
        }

        if (moduleDeclaration === undefined) {
          moduleDeclaration = statement;
        } else {
          // Has more than 1 declaration
          return {};
        }
      }
    }

    if (moduleDeclaration) {
      context.report({
        messageId: "oneModuleDeclaration",
        node: services.tsNodeToESTreeNodeMap.get(moduleDeclaration),
      });
    }

    return {};
  },
});

export = rule;
