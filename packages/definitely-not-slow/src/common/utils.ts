import * as os from 'os';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { SystemInfo, Document, JSONDocument, PackageBenchmarkSummary, QueryResult } from './types';
import { PackageId } from 'types-publisher/bin/lib/packages';
import { execAndThrowErrors } from 'types-publisher/bin/util/util';
import { gitChanges } from 'types-publisher/bin/tester/test-runner';
import { execSync } from 'child_process';

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

export type Args = { [key: string]: string | boolean | number };

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
        const boolArg = nextArg === 'true' ? true : nextArg === 'false' ? false : undefined;
        obj[arg.slice(2)] = boolArg || (isNaN(numberArg) ? nextArg : numberArg);
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
    throw new Error(`Expected a string for input${name ? ` '${name}'` : ''} but received ${typeof input}`);
  }
  return input;
}

export function assertNumber(input: any, name?: string): number {
  if (typeof input !== 'number') {
    throw new Error(`Expected a number for input${name ? ` '${name}'` : ''} but received ${typeof input}`);
  }
  return input;
}

export function assertBoolean(input: any, name?: string): boolean {
  if (typeof input !== 'boolean') {
    throw new Error(`Expected a boolean for input${name ? ` '${name}'` : ''} but received ${typeof input}`);
  }
  return input;
}

export function assertDefined<T>(input: T | null | undefined, name?: string): T {
  if (input == undefined) {
    throw new Error(`Expected ${name ? ` '${name}'` : ''} to be defined`);
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
    totalmem: os.totalmem(),
    nodeVersion: process.version,
  };

  return {
    ...info,
    hash: createHash('md5').update(JSON.stringify(info)).digest('hex'),
  };
}

export interface GetChangedPackagesOptions {
  diffFrom?: string;
  diffTo: string;
  definitelyTypedPath: string;
}

export async function getChangedPackages({
  diffFrom = 'HEAD',
  diffTo,
  definitelyTypedPath
}: GetChangedPackagesOptions) {
  const diff = await execAndThrowErrors(`git diff --name-status ${diffFrom} ${diffTo}`, definitelyTypedPath);
  if (!diff) {
    return undefined;
  }

  const changes = diff.split('\n').map(line => {
    const [status, file] = line.split(/\s+/, 2);
    return { status: status.trim() as 'A' | 'D' | 'M', file: file.trim() };
  });

  return gitChanges(changes);
}

export function packageIdsAreEqual(a: PackageId): (b: PackageId) => boolean;
export function packageIdsAreEqual(a: PackageId, b: PackageId): boolean;
export function packageIdsAreEqual(a: PackageId, b?: PackageId): boolean | ((b: PackageId) => boolean) {
  return typeof b === 'undefined' ? equalsA : equalsA(b);
  function equalsA(b: PackageId) {
    return a.name === b.name && a.majorVersion === b.majorVersion;
  }
}

export function getPercentDiff(actual: number, expected: number): number {
  return (actual - expected) / expected;
}

export function isWithin(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(getPercentDiff(actual, expected)) <= tolerance;
}

export function systemsAreCloseEnough(a: SystemInfo, b: SystemInfo, cpuSpeedTolerance = 0.1): boolean {
  if (a.hash === b.hash) {
    return true;
  }
  return a.arch === b.arch
    && a.platform === b.platform
    && a.nodeVersion === b.nodeVersion
    && a.cpus.length === b.cpus.length
    && a.cpus.every((cpu, index) => {
      const otherCPU = b.cpus[index];
      return cpu.model === otherCPU.model
        && isWithin(cpu.speed, otherCPU.speed, cpuSpeedTolerance);
    });
}

export function createDocument<T>(body: T, version: number): Document<T> {
  return {
    version,
    createdAt: new Date(),
    system: getSystemInfo(),
    body,
  };
}

export function parsePackageKey(key: string): PackageId {
  const [name, version] = key.split('/');
  return {
    name,
    majorVersion: parseInt(version.replace(/^v/, '')) || '*' as const,
  };
}

export function toPackageKey(name: string, majorVersion: string): string;
export function toPackageKey(packageId: PackageId): string;
export function toPackageKey(packageIdOrName: string | PackageId, majorVersion?: string) {
  const { name, majorVersion: version } = typeof packageIdOrName === 'string' ? { name: packageIdOrName, majorVersion } : packageIdOrName;
  return `${name}/v${version}`;
}

export function deserializeSummary(doc: QueryResult<JSONDocument<PackageBenchmarkSummary>>): QueryResult<Document<PackageBenchmarkSummary>>;
export function deserializeSummary(doc: JSONDocument<PackageBenchmarkSummary>): Document<PackageBenchmarkSummary> {
  return {
    ...doc,
    createdAt: new Date(doc.createdAt),
    body: {
      ...doc.body,
      batchRunStart: new Date(doc.body.batchRunStart),
    },
  };
}

export function getSourceVersion(cwd: string) {
  return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim()
}

export function shuffle<T>(array: readonly T[]): T[] {
  const output = array.slice();
  let counter = output.length;
  while (counter > 0) {
      const index = Math.floor(randomBytes(1).readUInt8(0) / 2 ** 8 * counter);
      counter--;
      const elem = output[counter];
      output[counter] = output[index];
      output[index] = elem;
  }

  return output;
}