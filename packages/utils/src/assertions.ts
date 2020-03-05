import assert from "assert";

export function assertDefined<T>(x: T | undefined, message?: string | Error | undefined): T {
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
  if ((<any>Error).captureStackTrace) {
    (<any>Error).captureStackTrace(e, stackCrawlMark || fail);
  }
  throw e;
}

export function assertSorted(a: readonly string[]): readonly string[];
export function assertSorted<T>(a: readonly T[], cb: (t: T) => string): readonly T[];
export function assertSorted<T>(
  a: readonly T[],
  cb: (t: T) => string = (t: T) => (t as unknown) as string
): readonly T[] {
  let prev = a[0];
  for (let i = 1; i < a.length; i++) {
    const x = a[i];
    assert(cb(x) >= cb(prev), `${JSON.stringify(x)} >= ${JSON.stringify(prev)}`);
    prev = x;
  }
  return a;
}
