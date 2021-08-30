import { pathExists } from "fs-extra";
import { join as joinPaths } from "path";

import { readJsonWithComments } from "./readJsonWithComments";

export async function checkTslintJson(dirPath: string, dt: boolean): Promise<void> {
  const configPath = getConfigPath(dirPath);
  const shouldExtend = `dtslint/${dt ? "dt" : "dtslint"}.json`;
  const validateExtends = (extend: string | string[]) =>
    extend === shouldExtend || (!dt && Array.isArray(extend) && extend.some(val => val === shouldExtend));

  if (!await pathExists(configPath)) {
    if (dt) {
      throw new Error(
        `On DefinitelyTyped, must include \`tslint.json\` containing \`{ "extends": "${shouldExtend}" }\`.\n` +
        "This was inferred as a DefinitelyTyped package because it contains a `// Type definitions for` header.");
    }
    return;
  }

  const tslintJson = await readJsonWithComments(configPath);
  if (!validateExtends(tslintJson.extends)) {
    throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
  }
}

function getConfigPath(dirPath: string): string {
  return joinPaths(dirPath, "tslint.json");
}
