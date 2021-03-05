import crypto from "crypto";

export function parseJson(text: string): object {
  try {
    return JSON.parse(text) as object;
  } catch (err) {
    throw new Error(`${(err as Error).message} due to JSON: ${text}`);
  }
}

export function identity<T>(t: T): T {
  return t;
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

export function removeVersionFromPackageName(packageName: string | undefined): string | undefined {
  return packageName?.replace(/\/v(\d){1,}$/i, "");
}

export async function sleep(seconds: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, seconds * 1000));
}
