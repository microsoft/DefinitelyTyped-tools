import crypto from "crypto";
import * as semver from "semver";

// TODO: This should likely go away, replaced by semver.parse+verify that patch is not specified
export function parsePackageSemver(version: string): { major: number, minor?: number } | "*" {
  if (version === "workspace:.") {
    return "*"
  }
  const start = new semver.Range(version).set[0][0].semver
  if (start === (semver.Comparator as any).ANY) {
    return "*"
  }
  else {
    // TODO: we should still use real semver but for now minor===0 => minor=undefined for compatibility
    return { major: start.major, minor: start.minor === 0 ? undefined : start.minor }
  }
}

export function tryParseJson<T>(text: string): unknown;
export function tryParseJson<T>(text: string, predicate: (parsed: unknown) => parsed is T): T | undefined;
export function tryParseJson<T>(text: string, predicate?: (parsed: unknown) => parsed is T) {
  try {
    return parseJson(text, predicate);
  } catch {
    return undefined;
  }
}

export function parseJson<T>(text: string): unknown;
export function parseJson<T>(text: string, predicate?: (parsed: unknown) => parsed is T): T;
export function parseJson<T>(text: string, predicate: (parsed: unknown) => parsed is T = (_): _ is T => true) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`${(err as Error).message} due to JSON: ${text}`);
  }
  if (!predicate(parsed)) {
    throw new Error("Parsed JSON did not match required form");
  }
  return parsed;
}

export function identity<T>(t: T): T {
  return t;
}

export function isObject(value: unknown): value is object {
  return !!value && typeof value === "object";
}

export function withoutStart(s: string, start: string): string | undefined {
  return s.startsWith(start) ? s.slice(start.length) : undefined;
}

export function computeHash(content: string): string {
  // Normalize line endings
  const normalContent = content.replace(/\r\n?/g, "\n");
  const h = crypto.createHash("sha256");
  h.update(normalContent, "utf8");
  return h.digest("hex");
}

export function isScopedPackage(packageName: string): boolean {
  return packageName.startsWith("@");
}

// Based on `getPackageNameFromAtTypesDirectory` in TypeScript.
export function unmangleScopedPackage(packageName: string): string | undefined {
  const separator = "__";
  return packageName.includes(separator) ? `@${packageName.replace(separator, "/")}` : undefined;
}

// Reverts unmangleScopedPackage.
export function mangleScopedPackage(packageName: string): string {
  return isScopedPackage(packageName) ? packageName.replace(/\//, "__").replace("@", "") : packageName;
}

export async function sleep(seconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));
}
