import { ExportErrorKind, Mode } from "@definitelytyped/dts-critic";

export type CodeRawOptionError = [ExportErrorKind, boolean];

export interface CodeRawOptions {
  mode: Mode.Code;
  errors: CodeRawOptionError[];
}

export interface NameOnlyRawOptions {
  mode: Mode.NameOnly;
}

export type NpmNamingOptions = CodeRawOptions | NameOnlyRawOptions;
