import * as os from 'os';
import * as fs from 'fs';
import { fork } from 'child_process';
import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemInfo } from './types';

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

export type Args = { [key: string]: string | true | number };

export function deserializeArgs(args: string[]): Args {
  const obj: Args = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('--')) {
        obj[arg.slice(2)] = true;
      } else {
        const numberArg = parseFloat(nextArg);
        obj[arg.slice(2)] = isNaN(numberArg) ? nextArg : numberArg;
        i++;
      }
    }
  }
  return obj;
}

export function serializeArgs(args: Args): string {
  return Object.keys(args).map(arg => `--${arg}` + (args[arg] === true ? '' : args[arg].toString())).join(' ');
}

export function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((elem): elem is T => elem != undefined);
}

export function assertString(input: any, name?: string): string {
  if (typeof input !== 'string') {
    throw new Error(`Expected a string for input${name ? ` '${name}'` : ''} but received a ${typeof input}`);
  }
  return input;
}

export function assertNumber(input: any, name?: string): number {
  if (typeof input !== 'number') {
    throw new Error(`Expected a number for input${name ? ` '${name}'` : ''} but received a ${typeof input}`);
  }
  return input;
}

export function assertBoolean(input: any, name?: string): boolean {
  if (typeof input !== 'boolean') {
    throw new Error(`Expected a boolean for input${name ? ` '${name}'` : ''} but received a ${typeof input}`);
  }
  return input;
}

export function withDefault<T>(input: T, defaultValue: T): T {
  return typeof input === 'undefined' ? defaultValue : input;
}

export function getSystemInfo(): SystemInfo {
  const info = {
    cpus: os.cpus().map(({ times, ...cpu }) => cpu),
    arch: os.arch(),
    platform: os.platform(),
    release: os.release(),
    totalmem: os.totalmem()
  };

  return {
    ...info,
    hash: createHash('md5').update(JSON.stringify(info)).digest('hex'),
  };
}

let port = 9230;
function getExecArgv(execArgv: string[]) {
  const allExecArgv = process.execArgv.concat(execArgv);
  if (allExecArgv.some(arg => arg.startsWith('--inspect-brk'))) {
    return execArgv.concat(`--inspect-brk=${port++}`);
  }
  if (allExecArgv.some(arg => arg.startsWith('--inspect'))) {
    return execArgv.concat(`--inspect=${port++}`);
  }
  return execArgv;
}

export interface RunInChildProcessesOptions<T> {
  workerFile: string;
  inputs: T[];
  maxRetries?: number;
  nParallel: number;
  args?: string[] | ((input: T, index: number) => string[]);
  execArgv?: string[] | ((input: T, index: number) => string[]);
  handleOutput?: (message: any, input: T, index: number) => void;
}

export async function runInChildProcesses<T>({
  workerFile,
  args,
  inputs,
  nParallel,
  maxRetries = 0,
  execArgv,
  handleOutput,
}: RunInChildProcessesOptions<T>) {
  let runningProcesses: Promise<void>[] = [];

  for (let i = 0; i < inputs.length; i++) {
    await openSlot();
    startChild(i);
  }

  return Promise.all(runningProcesses);

  async function openSlot(): Promise<void> {
    if (runningProcesses.length < nParallel) {
      return;
    }

    await Promise.race(runningProcesses);
    return openSlot();
  }

  function startChild(index: number, attempt = 0): Promise<void> {
    const input = inputs[index];
    const childArgs = typeof args === 'function' ? args(input, index) : args;
    const childExecArgs = getExecArgv(typeof execArgv === 'function' ? execArgv(input, index) : execArgv || []);
    const promise = new Promise<void>((resolve, reject) => {
      const child = fork(workerFile, childArgs, { execArgv: childExecArgs });
      if (handleOutput) {
        child.on('message', message => {
          handleOutput(message, input, index);
        });
      }
      child.on('exit', onExit);
      child.on('error', err => {
        child.removeListener('exit', onExit);
        reject(err);
      });
      child.send(input);

      function onExit(exitCode: number | null, signal: string | null) {
        if (exitCode === 0) {
          resolve();
        } else if (attempt < maxRetries) {
          startChild(index, attempt + 1).then(resolve, reject);
        } else {
          if (exitCode !== null) {
            reject(new Error(`Child process exited with code ${exitCode} on input index ${index}`));
          } else {
            reject(new Error(`Child process was killed with ${signal} on input index ${index}`));
          }
        }
      }
    });
    runningProcesses.push(promise);
    return promise.then(() => {
      runningProcesses.splice(runningProcesses.indexOf(promise), 1);
    });
  }
}
