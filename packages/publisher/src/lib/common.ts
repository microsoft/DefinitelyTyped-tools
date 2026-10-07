import { ParseDefinitionsOptions } from "@definitelytyped/definitions-parser";
import path from "path";

export interface TesterOptions extends ParseDefinitionsOptions {
  // Tester can only run on files stored on-disk.
  readonly definitelyTypedPath: string;
}

export const defaultLocalOptions: TesterOptions = {
  definitelyTypedPath: path.resolve(__dirname, "../../../../../DefinitelyTyped"),
  progress: true,
};

export const defaultRemoteOptions: ParseDefinitionsOptions = {
  definitelyTypedPath: undefined,
  progress: false,
};
