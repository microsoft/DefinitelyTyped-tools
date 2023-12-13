import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import { createRule } from "../util";

const rule = createRule({
  name: "strict-export-declare-modifiers",
  defaultOptions: [],
  meta: {
    type: "problem",
    docs: {
      description: "Enforces strict rules about where the 'export' and 'declare' modifiers may appear.",
    },
    messages: {
      missingExplicitExport:
        "All declarations in this module are exported automatically. " +
        "Prefer to explicitly write 'export' for clarity. " +
        "If you have a good reason not to export this declaration, " +
        "add 'export {}' to the module to shut off automatic exporting.",
      redundantDeclare: "'declare' keyword is redundant here.",
      redundantExport:
        "'export' keyword is redundant here because " +
        "all declarations in this module are exported automatically. " +
        "If you have a good reason to export some declarations and not others, " +
        "add 'export {}' to the module to shut off automatic exporting.",
    },
    schema: [],
  },
  // TODO: This code is a modified version of the old TSLint rule,
  // and still primarily uses TypeScript nodes. It would be better
  // to switch it to using TSESTree nodes like other ESLint rules.
  create(context) {
    const services = ESLintUtils.getParserServices(context, true);
    const sourceCode = context.sourceCode;
    const sourceFile = services.esTreeNodeToTSNodeMap.get(sourceCode.ast);

    const isExternal =
      sourceFile.isDeclarationFile &&
      !sourceFile.statements.some(
        (s) =>
          s.kind === ts.SyntaxKind.ExportAssignment ||
          (s.kind === ts.SyntaxKind.ExportDeclaration && !!(s as ts.ExportDeclaration).exportClause),
      ) &&
      ts.isExternalModule(sourceFile);

    for (const node of sourceFile.statements) {
      if (isExternal) {
        checkInExternalModule(node, isAutomaticExport(sourceFile));
      } else {
        checkInOther(node, sourceFile.isDeclarationFile);
      }

      if (isModuleDeclaration(node) && (sourceFile.isDeclarationFile || isDeclare(node))) {
        checkModule(node);
      }
    }

    function checkInExternalModule(node: ts.Statement, autoExportEnabled: boolean) {
      // Ignore certain node kinds (these can't have 'export' or 'default' modifiers)
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.ExportDeclaration:
        case ts.SyntaxKind.NamespaceExportDeclaration:
          return;
      }

      // `declare global` and `declare module "foo"` OK. `declare namespace N` not OK, should be `export namespace`.
      if (!isDeclareGlobalOrExternalModuleDeclaration(node)) {
        if (isDeclare(node)) {
          context.report({
            loc: getModifierLoc(node as ts.HasModifiers, ts.SyntaxKind.DeclareKeyword)!,
            messageId: "redundantDeclare",
          });
        }
        if (autoExportEnabled && !isExport(node)) {
          const n = (node as ts.DeclarationStatement).name || node;
          context.report({
            messageId: "missingExplicitExport",
            loc: {
              end: sourceCode.getLocFromIndex(n.end),
              start: sourceCode.getLocFromIndex(n.getStart(sourceFile)),
            },
          });
        }
      }
    }

    function checkInOther(node: ts.Statement, inDeclarationFile: boolean): void {
      // Compiler will enforce presence of 'declare' where necessary. But types do not need 'declare'.
      if (isDeclare(node)) {
        if (
          (isExport(node) && inDeclarationFile) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node)
        ) {
          context.report({
            loc: getModifierLoc(node as ts.HasModifiers, ts.SyntaxKind.DeclareKeyword),
            messageId: "redundantDeclare",
          });
        }
      }
    }

    function getModifierLoc(node: ts.HasModifiers, kind: ts.SyntaxKind) {
      const modifier = ts.getModifiers(node)?.find((modifier) => modifier.kind === kind)!;

      return {
        end: sourceCode.getLocFromIndex(modifier.end),
        start: sourceCode.getLocFromIndex(modifier.getStart(sourceFile)),
      };
    }

    function checkModule(moduleDeclaration: ts.ModuleDeclaration): void {
      const body = moduleDeclaration.body;
      if (!body) {
        return;
      }

      switch (body.kind) {
        case ts.SyntaxKind.ModuleDeclaration:
          checkModule(body);
          break;
        case ts.SyntaxKind.ModuleBlock:
          checkBlock(body, isAutomaticExport(moduleDeclaration));
          break;
      }
    }

    function checkBlock(block: ts.ModuleBlock, autoExportEnabled: boolean): void {
      for (const statement of block.statements) {
        // Compiler will error for 'declare' here anyway, so just check for 'export'.
        if (isExport(statement) && autoExportEnabled && !isDefault(statement)) {
          context.report({
            loc: getModifierLoc(statement as ts.HasModifiers, ts.SyntaxKind.ExportKeyword),
            messageId: "redundantExport",
          });
        }

        if (isModuleDeclaration(statement)) {
          checkModule(statement);
        }
      }
    }

    return {};
  },
});

function isDeclareGlobalOrExternalModuleDeclaration(node: ts.Node): boolean {
  return (
    isModuleDeclaration(node) &&
    (node.name.kind === ts.SyntaxKind.StringLiteral ||
      (node.name.kind === ts.SyntaxKind.Identifier && node.name.text === "global"))
  );
}

function isModuleDeclaration(node: ts.Node): node is ts.ModuleDeclaration {
  return node.kind === ts.SyntaxKind.ModuleDeclaration;
}

function isDeclare(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
}

function isExport(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isDefault(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

// tslint:disable-next-line:max-line-length
// Copied from https://github.com/Microsoft/TypeScript/blob/dd9b8cab34a3e389e924d768eb656cf50656f582/src/compiler/binder.ts#L1571-L1581
function hasExportDeclarations(node: ts.SourceFile | ts.ModuleDeclaration): boolean {
  const body = node.kind === ts.SyntaxKind.SourceFile ? node : node.body;
  if (body && (body.kind === ts.SyntaxKind.SourceFile || body.kind === ts.SyntaxKind.ModuleBlock)) {
    for (const stat of (body as ts.BlockLike).statements) {
      if (stat.kind === ts.SyntaxKind.ExportDeclaration || stat.kind === ts.SyntaxKind.ExportAssignment) {
        return true;
      }
    }
  }
  return false;
}

function isAutomaticExport(node: ts.SourceFile | ts.ModuleDeclaration): boolean {
  // We'd like to just test ts.NodeFlags.ExportContext, but we don't run the
  // binder, so that flag won't be set, so duplicate the logic instead. :(
  //
  // ts.NodeFlags.Ambient is @internal, but all modules that get here should
  // be ambient.
  return !hasExportDeclarations(node);
}

export = rule;
