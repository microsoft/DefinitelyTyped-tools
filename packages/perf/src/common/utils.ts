import * as os from "os";
import * as fs from "fs";
import { randomBytes, createHash } from "crypto";
import { promisify } from "util";
import { execSync } from "child_process";
import { SystemInfo, Document, JSONDocument, PackageBenchmarkSummary, QueryResult, PackageBenchmark } from "./types";
import { assertDefined, execAndThrowErrors } from "@definitelytyped/utils";
import {
  PackageId,
  gitChanges,
  formatDependencyVersion,
  DirectoryParsedTypingVersion,
  tryParsePackageVersion,
  PackageIdWithDefiniteVersion
} from "@definitelytyped/definitions-parser";

export const pathExists = promisify(fs.exists);

export function ensureExists(...pathNames: string[]): string {
  for (const pathName of pathNames) {
    // tslint:disable-next-line:non-literal-fs-path -- filename comes from Azure artifact
    if (fs.existsSync(pathName)) {
      return pathName;
    }
  }
  const pathNamesPrint = pathNames.length > 1 ? "\n" + pathNames.map(s => ` - ${s}`).join("\n") : `'${pathNames[0]}`;
  throw new Error(`File or directory does not exist: ${pathNamesPrint}`);
}

export function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((elem): elem is T => elem !== null && elem !== undefined);
}

export function assertString(input: any, name?: string): string {
  if (typeof input !== "string") {
    throw new Error(`Expected a string for input${name ? ` '${name}'` : ""} but received ${typeof input}`);
  }
  return input;
}

export function assertNumber(input: any, name?: string): number {
  if (typeof input !== "number") {
    throw new Error(`Expected a number for input${name ? ` '${name}'` : ""} but received ${typeof input}`);
  }
  return input;
}

export function getSystemInfo(): SystemInfo {
  const info = {
    cpus: os.cpus().map(({ times, ...cpu }) => cpu),
    arch: os.arch(),
    platform: os.platform(),
    release: os.release(),
    totalmem: os.totalmem(),
    nodeVersion: process.version
  };

  return {
    ...info,
    hash: createHash("md5")
      .update(JSON.stringify(info))
      .digest("hex")
  };
}

export interface GetChangedPackagesOptions {
  diffFrom?: string;
  diffTo: string;
  definitelyTypedPath: string;
}

export async function getChangedPackages({
  diffFrom = "HEAD",
  diffTo,
  definitelyTypedPath
}: GetChangedPackagesOptions) {
  const diff = await execAndThrowErrors(`git diff --name-status ${diffFrom} ${diffTo}`, definitelyTypedPath);
  if (!diff) {
    return undefined;
  }

  const changes = diff.split("\n").map(line => {
    const [status, file] = line.split(/\s+/, 2);
    return { status: status.trim() as "A" | "D" | "M", file: file.trim() };
  });

  return gitChanges(changes);
}

export function packageIdsAreEqual(a: PackageId): (b: PackageId) => boolean;
export function packageIdsAreEqual(a: PackageId, b: PackageId): boolean;
export function packageIdsAreEqual(a: PackageId, b?: PackageId): boolean | ((b: PackageId) => boolean) {
  return b === undefined ? equalsA : equalsA(b);
  function equalsA(b: PackageId) {
    return a.name === b.name && a.version === b.version;
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
  return (
    a.arch === b.arch &&
    a.platform === b.platform &&
    a.nodeVersion === b.nodeVersion &&
    a.cpus.length === b.cpus.length &&
    a.cpus.every((cpu, index) => {
      const otherCPU = b.cpus[index];
      return cpu.model === otherCPU.model && isWithin(cpu.speed, otherCPU.speed, cpuSpeedTolerance);
    })
  );
}

export function createDocument<T>(body: T, version: number): Document<T> {
  return {
    version,
    createdAt: new Date(),
    system: getSystemInfo(),
    body
  };
}

export function isVersionedBenchmark(
  obj: any
): obj is Pick<PackageBenchmark, "packageVersionMajor" | "packageVersionMinor"> {
  return typeof obj.packageVersionMajor === "number" && obj.packageVersionMinor === "number";
}

export function packageVersionsAreEqual(
  a: PackageBenchmarkSummary | PackageBenchmark,
  b: PackageBenchmarkSummary | PackageBenchmark
) {
  return a.packageVersionMajor === b.packageVersionMajor && a.packageVersionMinor === b.packageVersionMinor;
}

export function parsePackageKey(key: string): PackageId {
  const [name, versionString] = key.split("/");
  const version = tryParsePackageVersion(versionString);
  return { name, version };
}

export function toPackageKey(name: string, version: string | DirectoryParsedTypingVersion): string;
export function toPackageKey(
  packageId: PackageIdWithDefiniteVersion | PackageBenchmark | PackageBenchmarkSummary
): string;
export function toPackageKey(
  packageIdOrName: string | PackageIdWithDefiniteVersion | PackageBenchmark | PackageBenchmarkSummary,
  version?: string | DirectoryParsedTypingVersion
) {
  const packageId =
    typeof packageIdOrName === "string"
      ? {
          name: packageIdOrName,
          version: (typeof version === "string" ? tryParsePackageVersion(version) : version) || ("*" as const)
        }
      : isVersionedBenchmark(packageIdOrName)
      ? {
          name: packageIdOrName.packageName,
          version: { major: packageIdOrName.packageVersionMajor, minor: packageIdOrName.packageVersionMinor }
        }
      : packageIdOrName;

  assertDefined(
    packageId.version,
    `Could not determine package version from benchmark: ${JSON.stringify(packageIdOrName, undefined, 2)}`
  );
  return `${packageId.name}/${formatDependencyVersion(packageId.version)}`;
}

export function deserializeSummary(
  doc: QueryResult<JSONDocument<PackageBenchmarkSummary>>
): QueryResult<Document<PackageBenchmarkSummary>>;
export function deserializeSummary(doc: JSONDocument<PackageBenchmarkSummary>): Document<PackageBenchmarkSummary> {
  return {
    ...doc,
    createdAt: new Date(doc.createdAt),
    body: {
      ...doc.body,
      batchRunStart: new Date(doc.body.batchRunStart)
    }
  };
}

export function getSourceVersion(cwd: string) {
  return execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
}

export function shuffle<T>(array: readonly T[]): T[] {
  const output = array.slice();
  let counter = output.length;
  while (counter > 0) {
    const index = Math.floor((randomBytes(1).readUInt8(0) / 2 ** 8) * counter);
    counter--;
    const elem = output[counter];
    output[counter] = output[index];
    output[index] = elem;
  }

  return output;
}

export function not<P extends unknown[]>(fn: (...args: P) => boolean): (...args: P) => boolean {
  return (...args) => !fn(...args);
}

export function findLast<T>(arr: T[], predicate: (element: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    const element = arr[i];
    if (predicate(element)) {
      return element;
    }
  }
  return;
}

export async function forEachWithTimeLimit<T>(
  limitMs: number,
  array: readonly T[],
  inTimeAction: (item: T) => unknown,
  outOfTimeAction: (item: T) => void
) {
  const startTime = Date.now();
  let complete = true;
  for (const item of array) {
    if (Date.now() - startTime > limitMs) {
      outOfTimeAction(item);
      complete = false;
    } else {
      await inTimeAction(item);
    }
  }
  const duration = Date.now() - startTime;
  return {
    startTime,
    duration,
    overtime: duration > limitMs,
    complete
  };
}
