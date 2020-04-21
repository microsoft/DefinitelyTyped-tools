export interface PreparePackagesOptions {
  definitelyTypedPath: string;
  nProcesses: number;
  noInstall?: boolean;
}

export interface PreparePackagesResult {
  packageNames: readonly string[];
  dependents: readonly string[];
}

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
  selection: "all" | "affected";
  noInstall?: boolean;
  onlyTestTsNext?: boolean;
  expectOnly?: boolean;
  localTypeScriptPath?: string;
  nProcesses?: number;
  shard?: { id: number; count: number };
}
