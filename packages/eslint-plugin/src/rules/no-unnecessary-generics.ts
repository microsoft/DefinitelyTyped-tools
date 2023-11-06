import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import * as ts from "typescript";

import { createRule } from "../util";

type ESTreeFunctionLikeWithTypeParameters = TSESTree.FunctionLike & {
  typeParameters: {};
};

type TSSignatureDeclarationWithTypeParameters = ts.SignatureDeclaration & {
  typeParameters: {};
};

const rule = createRule({
  defaultOptions: [],
  meta: {
    docs: {
      description: "Forbids signatures using a generic parameter only once.",
      recommended: "error",
    },
    messages: {
      never: "Type parameter {{name}} is never used.",
      sole: "Type parameter {{name}} is used only once.",
    },
    schema: [],
    type: "problem",
  },
  name: "no-unnecessary-generics",
  create(context) {
    return {
      [[
        "ArrowFunctionExpression[typeParameters]",
        "FunctionDeclaration[typeParameters]",
        "FunctionExpression[typeParameters]",
        "TSCallSignatureDeclaration[typeParameters]",
        "TSConstructorType[typeParameters]",
        "TSDeclareFunction[typeParameters]",
        "TSFunctionType[typeParameters]",
        "TSMethodSignature[typeParameters]",
      ].join(", ")](esNode: ESTreeFunctionLikeWithTypeParameters) {
        const parserServices = ESLintUtils.getParserServices(context);
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(esNode) as TSSignatureDeclarationWithTypeParameters;
        if (!tsNode.typeParameters) {
          return;
        }

        const checker = parserServices.program.getTypeChecker();

        for (const typeParameter of tsNode.typeParameters) {
          const result = getSoleUse(tsNode, assertDefined(checker.getSymbolAtLocation(typeParameter.name)), checker);

          if (result === "ok") {
            continue;
          }

          context.report({
            data: { name: typeParameter.name.text },
            messageId: result,
            node: parserServices.tsNodeToESTreeNodeMap.get(typeParameter),
          });
        }
      },
    };
  },
});

type Result = "ok" | "never" | "sole";

function getSoleUse(sig: ts.SignatureDeclaration, typeParameterSymbol: ts.Symbol, checker: ts.TypeChecker): Result {
  const exit = {};
  let soleUse: ts.Identifier | undefined;

  try {
    if (sig.typeParameters) {
      for (const tp of sig.typeParameters) {
        if (tp.constraint) {
          recur(tp.constraint);
        }
      }
    }
    for (const param of sig.parameters) {
      if (param.type) {
        recur(param.type);
      }
    }
    if (sig.type) {
      recur(sig.type);
    }
  } catch (err) {
    if (err === exit) {
      return "ok";
    }
    throw err;
  }

  return soleUse ? "sole" : "never";

  function recur(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      if (checker.getSymbolAtLocation(node) === typeParameterSymbol) {
        if (soleUse === undefined) {
          soleUse = node;
        } else {
          throw exit;
        }
      }
    } else {
      node.forEachChild(recur);
    }
  }
}

export = rule;

function assertDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("unreachable");
  }
  return value;
}
