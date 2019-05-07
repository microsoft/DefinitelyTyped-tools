import * as fs from 'fs';
import { promisify } from 'util';
import { installAll, typeScriptPath, cleanInstalls, installNext } from 'dtslint/bin/installer';
const exists = promisify(fs.exists);

export async function getTypeScript(
  version: string,
  localTypeScriptPath?: string,
): Promise<typeof import('typescript')> {
  const path = typeScriptPath(version, localTypeScriptPath);
  if (version === 'next') {
    await cleanInstalls();
    await installNext();
  } else if (!await exists(path)) {
    await installAll();
  }
  if (!await exists(path)) {
    throw new Error(`Version ${version} is not available`);
  }
  return import(path);
}
