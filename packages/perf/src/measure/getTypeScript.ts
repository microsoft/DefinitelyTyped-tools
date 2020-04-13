import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { installAll, typeScriptPath, cleanInstalls, installNext } from 'dtslint/bin/installer';
const exists = promisify(fs.exists);

export async function getTypeScript(
  version: string,
  localTypeScriptPath?: string,
  install = true,
): Promise<{ ts: typeof import('typescript'), tsPath: string }> {
  const tsPath = path.resolve(typeScriptPath(version, localTypeScriptPath));
  if (install) {
    if (version === 'next') {
      await cleanInstalls();
      await installNext();
    } else if (!await exists(tsPath)) {
      await installAll();
    }
  }
  if (!await exists(tsPath)) {
    throw new Error(`Version ${version} is not available at ${tsPath}`);
  }
  return {
    ts: await import(tsPath),
    tsPath,
  };
}
