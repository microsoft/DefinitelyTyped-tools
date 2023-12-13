import assert from "assert";

export function assertDefined<T>(x: T | undefined, message?: string | Error | undefined): T {
  if (x === undefined) {
    debugger;
  }
  assert(x !== undefined, message);
  return x!;
}

export function assertNever(member: never, message = "Illegal value:", stackCrawlMark?: AnyFunction): never {
  const detail = JSON.stringify(member);
  return fail(`${message} ${detail}`, stackCrawlMark || assertNever);
}

type AnyFunction = (...args: never[]) => void;
export function fail(message?: string, stackCrawlMark?: AnyFunction): never {
  debugger;
  const e = new Error(message ? `Debug Failure. ${message}` : "Debug Failure.");
  if ((Error as any).captureStackTrace) {
    (Error as any).captureStackTrace(e, stackCrawlMark || fail);
  }
  throw e;
}

export function assertSorted(a: readonly string[]): readonly string[];
export function assertSorted<T>(a: readonly T[], cb: (t: T) => string): readonly T[];
export function assertSorted<T>(
  a: readonly T[],
  cb: (t: T) => string = (t: T) => t as unknown as string,
): readonly T[] {
  let prev = a[0];
  for (let i = 1; i < a.length; i++) {
    const x = a[i];
    assert(cb(x) >= cb(prev), `${JSON.stringify(x)} >= ${JSON.stringify(prev)}`);
    prev = x;
  }
  return a;
}

export function deepEquals(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => deepEquals(e, actual[i]))
    );
  } else if (typeof expected === "object" && typeof actual === "object" && actual !== null) {
    for (const k in expected) {
      if (!deepEquals((expected as any)[k], (actual as any)[k])) {
        return false;
      }
    }
    return true;
  } else {
    return expected === actual;
  }
}
