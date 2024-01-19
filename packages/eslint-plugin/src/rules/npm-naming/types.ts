import { ExportErrorKind } from "@definitelytyped/dts-critic";

export type CodeRawOptionError = [ExportErrorKind, boolean];

export interface NpmNamingOptions {
  implementationPackageDirectory: string;
  errors: CodeRawOptionError[];
}

