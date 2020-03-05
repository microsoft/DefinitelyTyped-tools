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

// Based on `getPackageNameFromAtTypesDirectory` in TypeScript.
export function unmangleScopedPackage(packageName: string): string | undefined {
  const separator = "__";
  return packageName.includes(separator) ? `@${packageName.replace(separator, "/")}` : undefined;
}
