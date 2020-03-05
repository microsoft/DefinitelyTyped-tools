import { ParseDefinitionsOptions } from "@definitelytyped/definitions-parser";

if (process.env.LONGJOHN) {
  console.log("=== USING LONGJOHN ===");
  const longjohn = require("longjohn") as { async_trace_limit: number }; // tslint:disable-line no-var-requires
  longjohn.async_trace_limit = -1; // unlimited
}

/** Which registry to publish to */
export enum Registry {
  /** types-registry and @types/* on NPM */
  NPM,
  /** @definitelytyped/types-registry and @types/* on Github */
  Github
}

export interface TesterOptions extends ParseDefinitionsOptions {
  // Tester can only run on files stored on-disk.
  readonly definitelyTypedPath: string;
}

export const defaultLocalOptions: TesterOptions = {
  definitelyTypedPath: "../DefinitelyTyped",
  progress: true,
  parseInParallel: true
};
