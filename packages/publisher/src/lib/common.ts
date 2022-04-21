import { ParseDefinitionsOptions } from "@definitelytyped/definitions-parser";

if (process.env.LONGJOHN) {
  console.log("=== USING LONGJOHN ===");
  const longjohn = require("longjohn") as { async_trace_limit: number }; // tslint:disable-line no-var-requires
  longjohn.async_trace_limit = -1; // unlimited
}

export interface TesterOptions extends ParseDefinitionsOptions {
  // Tester can only run on files stored on-disk.
  readonly definitelyTypedPath: string;
}

export const defaultLocalOptions: TesterOptions = {
  definitelyTypedPath: "../../../DefinitelyTyped",
  progress: true,
  parseInParallel: true,
};

export const defaultRemoteOptions: ParseDefinitionsOptions = {
  definitelyTypedPath: undefined,
  progress: false,
  parseInParallel: false,
};
