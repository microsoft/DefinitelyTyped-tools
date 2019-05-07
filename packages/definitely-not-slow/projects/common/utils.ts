import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

export const pathExists = promisify(fs.exists);

export function ensureExists(...pathNames: string[]): string {
  for (const pathName of pathNames) {
    if (fs.existsSync(pathName)) {
      return pathName;
    }
  }
  const pathNamesPrint = pathNames.length > 1 ? '\n' + pathNames.map(s => ` - ${s}`).join('\n') : `'${pathNames[0]}`;
  throw new Error(`File or directory does not exist: ${pathNamesPrint}`);
}

export function run(cwd: string | undefined, cmd: string): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve, reject) => {
    exec(cmd, { encoding: 'utf8', cwd }, (error, stdoutUntrimmed, stderrUntrimmed) => {
      const stdout = stdoutUntrimmed.trim();
      const stderr = stderrUntrimmed.trim();
      if (stderr !== "") {
        reject(new Error(stderr));
      } else if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}