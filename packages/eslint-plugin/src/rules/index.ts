import * as dtHeader from "./dt-header";
import * as exportJustNamespace from "./export-just-namespace";
import * as noAnyUnion from "./no-any-union";
import * as noBadReference from "./no-bad-reference";
import * as noConstEnum from "./no-const-enum";
import * as noDeadReference from "./no-dead-reference";
import * as noDeclareCurrentPackage from "./no-declare-current-package";
import * as noImportDefaultOfExportEquals from "./no-import-default-of-export-equals";
import * as noOutsideDependencies from "./no-outside-dependencies";
import * as noRelativeImportInTest from "./no-relative-import-in-test";
import * as noSelfImport from "./no-self-import";
import * as noSingleElementTupleType from "./no-single-element-tuple-type";
import * as noUnnecessaryGenerics from "./no-unnecessary-generics";
import * as noUselessFiles from "./no-useless-files";
import * as preferDeclareFunction from "./prefer-declare-function";
import * as redundantUndefined from "./redundant-undefined";
import * as strictExportDeclareModifiers from "./strict-export-declare-modifiers";

export const rules = {
  "dt-header": dtHeader,
  "export-just-namespace": exportJustNamespace,
  "no-any-union": noAnyUnion,
  "no-bad-reference": noBadReference,
  "no-const-enum": noConstEnum,
  "no-dead-reference": noDeadReference,
  "no-declare-current-package": noDeclareCurrentPackage,
  "no-import-default-of-export-equals": noImportDefaultOfExportEquals,
  "no-outside-dependencies": noOutsideDependencies,
  "no-relative-import-in-test": noRelativeImportInTest,
  "no-self-import": noSelfImport,
  "no-single-element-tuple-type": noSingleElementTupleType,
  "no-unnecessary-generics": noUnnecessaryGenerics,
  "no-useless-files": noUselessFiles,
  "prefer-declare-function": preferDeclareFunction,
  "redundant-undefined": redundantUndefined,
  "strict-export-declare-modifiers": strictExportDeclareModifiers,
};
