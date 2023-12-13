import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";

export type TsVersion = TypeScriptVersion | "local";

export function typeScriptPath(version: TsVersion, tsLocal: string | undefined): string {
  if (version === "local") {
    return tsLocal! + "/typescript.js";
  }
  return typeScriptPackages.resolve(version);
}
