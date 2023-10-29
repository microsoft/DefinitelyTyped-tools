import exportJustNamespace = require("./export-just-namespace");
import noAnyUnion = require("./no-any-union");
import noBadReference = require("./no-bad-reference");
import noConstEnum = require("./no-const-enum");
import noDeadReference = require("./no-dead-reference");
import noDeclareCurrentPackage = require("./no-declare-current-package");
import noImportDefaultOfExportEquals = require("./no-import-default-of-export-equals");
import noRelativeImportInTest = require("./no-relative-import-in-test");
import noSelfImport = require("./no-self-import");
import noSingleElementTupleType = require("./no-single-element-tuple-type");
import noUnnecessaryGenerics = require("./no-unnecessary-generics");
import noUselessFiles = require("./no-useless-files");
import preferDeclareFunction = require("./prefer-declare-function");
import redundantUndefined = require("./redundant-undefined");
import strictExportDeclareModifiers = require("./strict-export-declare-modifiers");
import noSingleDeclareModule = require("./no-single-declare-module");
import noOldDTHeader = require("./no-old-dt-header");
import noImportOfDevDependencies = require("./no-import-of-dev-dependencies");

export const rules = {
  "export-just-namespace": exportJustNamespace,
  "no-any-union": noAnyUnion,
  "no-bad-reference": noBadReference,
  "no-const-enum": noConstEnum,
  "no-dead-reference": noDeadReference,
  "no-declare-current-package": noDeclareCurrentPackage,
  "no-import-default-of-export-equals": noImportDefaultOfExportEquals,
  "no-relative-import-in-test": noRelativeImportInTest,
  "no-self-import": noSelfImport,
  "no-single-element-tuple-type": noSingleElementTupleType,
  "no-unnecessary-generics": noUnnecessaryGenerics,
  "no-useless-files": noUselessFiles,
  "prefer-declare-function": preferDeclareFunction,
  "redundant-undefined": redundantUndefined,
  "strict-export-declare-modifiers": strictExportDeclareModifiers,
  "no-single-declare-module": noSingleDeclareModule,
  "no-old-dt-header": noOldDTHeader,
  "no-import-of-dev-dependencies": noImportOfDevDependencies,
};
