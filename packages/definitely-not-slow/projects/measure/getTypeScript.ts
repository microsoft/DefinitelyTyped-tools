import * as fs from 'fs';
import { promisify } from 'util';
import { installAll, typeScriptPath, cleanInstalls, installNext } from 'dtslint/bin/installer';
const exists = promisify(fs.exists);

export async function getTypeScript(
  version: string,
  localTypeScriptPath?: string,
): Promise<{ ts: typeof import('typescript'), tsPath: string }> {
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
  return {
    ts: await import(path),
    tsPath: path,
  };
}
