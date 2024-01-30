export interface CloneDefinitelyTyped {
  kind: "clone";
  sha?: string;
}

export interface LocalDefinitelyTyped {
  kind: "local";
  path: string;
}

export interface RunDTSLintOptions {
  definitelyTypedAcquisition: CloneDefinitelyTyped | LocalDefinitelyTyped;
  onlyRunAffectedPackages: boolean;
  noInstall: boolean;
  onlyTestTsNext: boolean;
  expectOnly: boolean;
  skipNpmChecks: boolean;
  localTypeScriptPath?: string;
  nProcesses: number;
  shard?: { id: number; count: number };
  childRestartTaskInterval?: number;
  writeFailures?: string;
}
