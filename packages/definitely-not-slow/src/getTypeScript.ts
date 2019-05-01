import * as fs from 'fs';
import { promisify } from 'util';
import { installAll, typeScriptPath } from 'dtslint/bin/installer';
const exists = promisify(fs.exists);

export async function getTypeScript(
  version: string,
  localTypeScriptPath?: string
): Promise<typeof import('typescript')> {
  const path = typeScriptPath(version, localTypeScriptPath);
  if (!await exists(path)) {
    await installAll();
  }
  if (!await exists(path)) {
    throw new Error(`Version ${version} is not available`);
  }
  return import(path);
}
