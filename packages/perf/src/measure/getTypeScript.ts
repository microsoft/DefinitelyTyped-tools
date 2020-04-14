import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import {
  TsVersion,
  installAllTypeScriptVersions,
  typeScriptPath,
  cleanTypeScriptInstalls,
  installTypeScriptNext
} from "@definitelytyped/utils";
const exists = promisify(fs.exists);

export async function getTypeScript(
  version: string,
  localTypeScriptPath?: string,
  install = true
): Promise<{ ts: typeof import("typescript"); tsPath: string }> {
  const tsPath = path.resolve(typeScriptPath(version as TsVersion, localTypeScriptPath));
  if (install) {
    if (version === "next") {
      await cleanTypeScriptInstalls();
      await installTypeScriptNext();
    } else if (!(await exists(tsPath))) {
      await installAllTypeScriptVersions();
    }
  }
  if (!(await exists(tsPath))) {
    throw new Error(`Version ${version} is not available at ${tsPath}`);
  }
  return {
    ts: await import(tsPath),
    tsPath
  };
}
